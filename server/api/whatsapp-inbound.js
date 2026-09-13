import crypto from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, methodNotAllowed, sendError } from './_firebaseAdmin.js'

const ALLOWED_REPLY_TYPES = new Set(['interested', 'declined', 'stop', 'join', 'message', 'unknown'])

function cleanText(value, max = 4000) {
  return String(value || '').trim().slice(0, max)
}

function normalizeWhatsappNumber(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits || digits.length < 8 || digits.length > 15) {
    throw Object.assign(new Error('Invalid WhatsApp number.'), { statusCode: 400 })
  }
  return digits
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''))
  const right = Buffer.from(String(b || ''))
  if (left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

function requireWebhookSecret(req) {
  const expected = String(process.env.ASANIB_WEBHOOK_SECRET || '').trim()
  if (!expected) {
    throw Object.assign(new Error('ASANIB_WEBHOOK_SECRET is not configured.'), { statusCode: 503 })
  }

  const header = String(req.headers.authorization || '')
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token || !safeEqual(token, expected)) {
    throw Object.assign(new Error('Unauthorized.'), { statusCode: 401 })
  }
}

function millis(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value._seconds === 'number') return value._seconds * 1000
  return 0
}

async function findExternalProvider(from) {
  const snapshot = await adminDb.collection('externalProviders').where('whatsapp', '==', from).limit(1).get()
  if (snapshot.empty) return null
  const doc = snapshot.docs[0]
  return { id: doc.id, ref: doc.ref, ...doc.data() }
}

async function findLatestOpenDispatch(from) {
  const snapshot = await adminDb.collection('externalLeadDispatches').where('providerWhatsapp', '==', from).limit(25).get()
  const openStatuses = new Set(['sent', 'awaiting_reply'])
  const rows = snapshot.docs
    .map((doc) => ({ id: doc.id, ref: doc.ref, ...doc.data() }))
    .filter((row) => openStatuses.has(String(row.status || '')))
    .sort((a, b) => millis(b.sentAt || b.createdAt) - millis(a.sentAt || a.createdAt))
  return rows[0] || null
}

async function applyReplyAction({ from, replyType, text, receivedAt }) {
  const provider = await findExternalProvider(from)
  const dispatch = await findLatestOpenDispatch(from)
  const updates = []

  if (provider) {
    const providerPatch = {
      lastWhatsappInboundAt: receivedAt,
      lastWhatsappMessage: text,
      updatedAt: FieldValue.serverTimestamp(),
    }

    if (replyType === 'stop') {
      providerPatch.leadOptIn = false
      providerPatch.whatsappOptOutAt = receivedAt
      providerPatch.whatsappOptOutReason = 'provider_reply_stop'
    } else if (replyType === 'join') {
      providerPatch.registrationInterestAt = receivedAt
    } else if (replyType === 'interested') {
      providerPatch.lastInterestedAt = receivedAt
    } else if (replyType === 'declined') {
      providerPatch.lastDeclinedAt = receivedAt
    }

    updates.push(provider.ref.set(providerPatch, { merge: true }))
  }

  if (dispatch) {
    const status = replyType === 'interested'
      ? 'interested'
      : replyType === 'declined'
        ? 'declined'
        : replyType === 'stop'
          ? 'opted_out'
          : dispatch.status

    updates.push(dispatch.ref.set({
      status,
      replyType,
      replyText: text,
      repliedAt: receivedAt,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }))

    if (dispatch.requestId && ['interested', 'declined', 'stop'].includes(replyType)) {
      updates.push(adminDb.collection('requests').doc(String(dispatch.requestId)).set({
        externalLastReplyType: replyType,
        externalLastReplyAt: receivedAt,
        externalLastProviderWhatsapp: from,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true }))
    }
  }

  if (updates.length) await Promise.all(updates)
  return { providerId: provider?.id || null, dispatchId: dispatch?.id || null }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)

  try {
    requireWebhookSecret(req)

    const event = cleanText(req.body?.event, 80)
    if (event !== 'whatsapp.inbound') {
      return res.status(400).json({ error: 'Unsupported webhook event.' })
    }

    const from = normalizeWhatsappNumber(req.body?.from)
    const text = cleanText(req.body?.text, 4000)
    const messageId = cleanText(req.body?.messageId, 180)
    const replyTypeRaw = cleanText(req.body?.replyType, 40).toLowerCase()
    const replyType = ALLOWED_REPLY_TYPES.has(replyTypeRaw) ? replyTypeRaw : 'unknown'
    const receivedAtRaw = cleanText(req.body?.receivedAt, 80)
    const receivedAtDate = receivedAtRaw ? new Date(receivedAtRaw) : new Date()

    if (!text) return res.status(400).json({ error: 'text is required.' })
    if (!messageId) return res.status(400).json({ error: 'messageId is required.' })
    if (Number.isNaN(receivedAtDate.getTime())) {
      return res.status(400).json({ error: 'receivedAt is invalid.' })
    }

    const eventRef = adminDb.collection('whatsappInboundEvents').doc(messageId)
    const existing = await eventRef.get()
    if (existing.exists) {
      return res.status(200).json({ ok: true, duplicate: true })
    }

    const receivedAt = receivedAtDate.toISOString()
    await eventRef.create({
      event,
      from,
      text,
      replyType,
      messageId,
      receivedAt,
      createdAt: FieldValue.serverTimestamp(),
      source: 'asanib-whatsapp-gateway',
    })

    const action = await applyReplyAction({ from, replyType, text, receivedAt })

    return res.status(200).json({
      ok: true,
      duplicate: false,
      replyType,
      providerId: action.providerId,
      dispatchId: action.dispatchId,
    })
  } catch (error) {
    return sendError(res, error)
  }
}
