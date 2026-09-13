import crypto from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, methodNotAllowed, sendError } from './_firebaseAdmin.js'

const ALLOWED_REPLY_TYPES = new Set(['interested', 'declined', 'stop', 'join', 'message', 'unknown'])
function cleanText(value, max = 4000) { return String(value || '').trim().slice(0, max) }
function normalizeWhatsappNumber(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits || digits.length < 8 || digits.length > 15) throw Object.assign(new Error('Invalid WhatsApp number.'), { statusCode: 400 })
  return digits
}
function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''))
  const right = Buffer.from(String(b || ''))
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}
function requireWebhookSecret(req) {
  const expected = String(process.env.ASANIB_WEBHOOK_SECRET || '').trim()
  if (!expected) throw Object.assign(new Error('ASANIB_WEBHOOK_SECRET is not configured.'), { statusCode: 503 })
  const header = String(req.headers.authorization || '')
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token || !safeEqual(token, expected)) throw Object.assign(new Error('Unauthorized.'), { statusCode: 401 })
}
function millis(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value._seconds === 'number') return value._seconds * 1000
  return 0
}
function timingLabel(request) {
  if (request.urgency === 'now') return 'Needed now'
  if (request.urgency === 'today') return 'Needed today'
  return request.scheduledFor || 'Scheduled'
}

async function findExternalProvider(from) {
  const snapshot = await adminDb.collection('externalProviders').where('whatsapp', '==', from).limit(1).get()
  if (snapshot.empty) return null
  const doc = snapshot.docs[0]
  return { id: doc.id, ref: doc.ref, ...doc.data() }
}

async function findLatestOpenDispatch(from) {
  const snapshot = await adminDb.collection('externalLeadDispatches').where('providerWhatsapp', '==', from).limit(25).get()
  const rows = snapshot.docs
    .map((doc) => ({ id: doc.id, ref: doc.ref, ...doc.data() }))
    .filter((row) => ['sent', 'awaiting_reply'].includes(String(row.status || '')))
    .sort((a, b) => millis(b.sentAt || b.createdAt) - millis(a.sentAt || a.createdAt))
  return rows[0] || null
}

function customerDetailsReply(request) {
  const phone = String(request?.contactPhone || '').replace(/\D/g, '')
  if (!phone || !request?.shareContactConsent) return null
  return [
    'Thanks, here are the customer details for this Asanib lead:',
    '',
    request.query,
    `Location: ${request.location}`,
    request.budget ? `Budget: up to AED ${request.budget}` : null,
    `Timing: ${timingLabel(request)}`,
    '',
    `Customer WhatsApp/phone: +${phone}`,
    '',
    'Please contact the customer directly. Asanib does not take commission, and you keep 100% of the service payment.',
  ].filter(Boolean).join('\n')
}

async function applyReplyAction({ from, replyType, text, receivedAt }) {
  const provider = await findExternalProvider(from)
  const dispatch = await findLatestOpenDispatch(from)
  const updates = []
  let replyText = null

  if (provider) {
    const patch = { lastWhatsappInboundAt: receivedAt, lastWhatsappMessage: text, updatedAt: FieldValue.serverTimestamp() }
    if (replyType === 'stop') {
      patch.leadOptIn = false
      patch.whatsappOptOutAt = receivedAt
    } else if (replyType === 'interested') {
      patch.leadOptIn = true
      patch.leadOptInAt = receivedAt
      patch.lastInterestedAt = receivedAt
    } else if (replyType === 'join') {
      patch.registrationInterestAt = receivedAt
    } else if (replyType === 'declined') {
      patch.lastDeclinedAt = receivedAt
    }
    updates.push(provider.ref.set(patch, { merge: true }))
  }

  if (dispatch) {
    let status = dispatch.status
    if (replyType === 'interested') status = 'interested'
    if (replyType === 'declined') status = 'declined'
    if (replyType === 'stop') status = 'opted_out'

    if (replyType === 'interested' && dispatch.requestId) {
      const requestRef = adminDb.collection('requests').doc(String(dispatch.requestId))
      const requestSnap = await requestRef.get()
      if (requestSnap.exists) {
        const request = requestSnap.data()
        replyText = customerDetailsReply(request)
        if (replyText) {
          status = 'customer_details_released'
          updates.push(requestRef.set({
            externalMatchStatus: 'provider_interested',
            matchedExternalProviderId: dispatch.providerId || provider?.id || null,
            matchedExternalProviderName: dispatch.providerName || provider?.businessName || null,
            externalLastReplyAt: receivedAt,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true }))
        }
      }
    }

    updates.push(dispatch.ref.set({ status, replyType, replyText: text, repliedAt: receivedAt, updatedAt: FieldValue.serverTimestamp() }, { merge: true }))
  }

  if (updates.length) await Promise.all(updates)
  return { providerId: provider?.id || null, dispatchId: dispatch?.id || null, replyText }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    requireWebhookSecret(req)
    if (cleanText(req.body?.event, 80) !== 'whatsapp.inbound') return res.status(400).json({ error: 'Unsupported webhook event.' })

    const from = normalizeWhatsappNumber(req.body?.from)
    const text = cleanText(req.body?.text, 4000)
    const messageId = cleanText(req.body?.messageId, 180)
    const rawType = cleanText(req.body?.replyType, 40).toLowerCase()
    const replyType = ALLOWED_REPLY_TYPES.has(rawType) ? rawType : 'unknown'
    const receivedAtDate = req.body?.receivedAt ? new Date(cleanText(req.body.receivedAt, 80)) : new Date()
    if (!text || !messageId) return res.status(400).json({ error: 'text and messageId are required.' })
    if (Number.isNaN(receivedAtDate.getTime())) return res.status(400).json({ error: 'receivedAt is invalid.' })

    const eventRef = adminDb.collection('whatsappInboundEvents').doc(messageId)
    if ((await eventRef.get()).exists) return res.status(200).json({ ok: true, duplicate: true })

    const receivedAt = receivedAtDate.toISOString()
    await eventRef.create({ event: 'whatsapp.inbound', from, text, replyType, messageId, receivedAt, createdAt: FieldValue.serverTimestamp(), source: 'asanib-whatsapp-gateway' })
    const action = await applyReplyAction({ from, replyType, text, receivedAt })

    return res.status(200).json({
      ok: true,
      duplicate: false,
      replyType,
      providerId: action.providerId,
      dispatchId: action.dispatchId,
      replyText: action.replyText,
    })
  } catch (error) {
    return sendError(res, error)
  }
}
