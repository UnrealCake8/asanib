import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from './_firebaseAdmin.js'

const DEFAULT_GATEWAY_URL = 'https://wasoft.mplace.cc'
const DEFAULT_BATCH_SIZE = 3
const DEFAULT_RETRY_MINUTES = 7
const LOCK_MS = 30 * 1000

function numEnv(name, fallback, min, max) {
  const value = Number(process.env[name])
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback
}

function gatewayConfig() {
  return {
    url: String(process.env.WHATSAPP_GATEWAY_URL || DEFAULT_GATEWAY_URL).trim().replace(/\/$/, ''),
    secret: String(process.env.WHATSAPP_GATEWAY_SECRET || '').trim(),
  }
}

function millis(value) {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value._seconds === 'number') return value._seconds * 1000
  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? parsed : 0
}

function cleanList(value) {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : []
}

function requestAreaText(request) {
  return [request.location, request.locationData?.area, request.locationData?.city, request.locationData?.emirate]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function areaMatches(provider, request) {
  const haystack = requestAreaText(request)
  const areas = cleanList(provider.areas).map((area) => area.toLowerCase())
  if (!areas.length) return false
  return areas.some((area) => {
    if (['uae', 'all uae', 'united arab emirates', 'all'].includes(area)) return true
    return haystack.includes(area) || area.includes(haystack)
  })
}

function meaningfulTokens(value) {
  const stop = new Set(['services', 'service', 'local', 'home', 'the', 'and', 'for', 'with', 'help', 'repair'])
  return String(value || '').toLowerCase().split(/[^a-z0-9]+/).filter((token) => token && !stop.has(token) && (token.length >= 3 || token === 'ac'))
}

function categoryMatches(provider, request) {
  const categories = cleanList(provider.categories).map((item) => item.toLowerCase())
  if (!categories.length) return false
  const requestCategory = String(request.category || '').toLowerCase()
  if (categories.includes(requestCategory) || categories.includes('local services') || categories.includes('all services')) return true
  const requestText = [request.category, request.query, ...(Array.isArray(request.serviceTags) ? request.serviceTags : [])].join(' ').toLowerCase()
  return categories.some((category) => {
    if (requestText.includes(category)) return true
    const tokens = meaningfulTokens(category)
    return tokens.length > 0 && tokens.some((token) => requestText.includes(token))
  })
}

function providerScore(provider, request) {
  let score = 0
  const location = String(request.location || '').toLowerCase()
  if (cleanList(provider.areas).some((area) => location.includes(String(area).toLowerCase()))) score += 20
  const category = String(request.category || '').toLowerCase()
  if (cleanList(provider.categories).some((item) => String(item).toLowerCase() === category)) score += 20
  if (provider.lastContactedAt) score -= Math.min(10, Math.floor((Date.now() - millis(provider.lastContactedAt)) / 3600000) < 1 ? 10 : 0)
  return score
}

function timingLabel(request) {
  if (request.urgency === 'now') return 'Needed now'
  if (request.urgency === 'today') return 'Needed today'
  return request.scheduledFor || 'Scheduled'
}

function leadMessage(provider, request) {
  const greeting = provider.businessName ? `Hi ${provider.businessName}, I'm from Asanib.` : `Hi, I'm from Asanib.`
  return [
    greeting,
    '',
    'You are opted in to receive free Asanib customer leads.',
    '',
    `A customer in ${request.location} is looking for help with:`,
    request.query,
    request.budget ? `Budget: AED ${request.budget}` : null,
    `Timing: ${timingLabel(request)}`,
    '',
    'There is no fee or commission. You deal with the customer directly and keep 100% of what they pay.',
    '',
    'Reply YES if you can help. Asanib will then send the customer contact details automatically.',
    'Reply NO if you cannot take this job, or STOP to stop future Asanib leads.',
  ].filter((line) => line !== null).join('\n')
}

async function sendGatewayMessage(to, message) {
  const { url, secret } = gatewayConfig()
  if (!secret) throw new Error('WHATSAPP_GATEWAY_SECRET is not configured.')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(`${url}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ to, message }),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || `WhatsApp gateway returned ${response.status}.`)
    return payload
  } finally {
    clearTimeout(timeout)
  }
}

async function claimRequest(requestId, force) {
  const ref = adminDb.collection('requests').doc(requestId)
  return adminDb.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref)
    if (!snap.exists) return { ok: false, reason: 'not_found' }
    const request = { id: snap.id, ...snap.data() }
    if (request.status !== 'open') return { ok: false, reason: 'not_open' }
    if (request.matchedExternalProviderId) return { ok: false, reason: 'already_matched' }
    if (!request.shareContactConsent || !request.contactPhone) return { ok: false, reason: 'no_contact_consent' }
    const now = Date.now()
    if (!force && millis(request.externalDispatchLockUntil) > now) return { ok: false, reason: 'locked' }
    if (!force && millis(request.nextExternalDispatchAt) > now) return { ok: false, reason: 'not_due' }
    transaction.set(ref, { externalDispatchLockUntil: new Date(now + LOCK_MS), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    return { ok: true, request, ref }
  })
}

export async function dispatchExternalBatch(requestId, options = {}) {
  const force = options.force === true
  const batchSize = numEnv('EXTERNAL_LEAD_BATCH_SIZE', DEFAULT_BATCH_SIZE, 1, 5)
  const retryMinutes = numEnv('EXTERNAL_LEAD_RETRY_MINUTES', DEFAULT_RETRY_MINUTES, 2, 60)
  const claim = await claimRequest(requestId, force)
  if (!claim.ok) return { ok: true, skipped: true, reason: claim.reason }

  const { request, ref: requestRef } = claim
  try {
    const [providerSnap, dispatchSnap] = await Promise.all([
      adminDb.collection('externalProviders').where('leadOptIn', '==', true).limit(250).get(),
      adminDb.collection('externalLeadDispatches').where('requestId', '==', requestId).limit(100).get(),
    ])

    const dispatches = dispatchSnap.docs.map((doc) => ({ id: doc.id, ref: doc.ref, ...doc.data() }))
    const now = Date.now()
    const timeoutMs = retryMinutes * 60 * 1000
    const expired = dispatches.filter((item) => ['awaiting_reply', 'sent'].includes(String(item.status || '')) && now - millis(item.sentAt || item.createdAt) >= timeoutMs)
    if (expired.length) {
      const expireBatch = adminDb.batch()
      expired.forEach((item) => expireBatch.set(item.ref, { status: 'timed_out', timedOutAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }))
      await expireBatch.commit()
    }

    const stillWaiting = dispatches.some((item) => ['awaiting_reply', 'sent'].includes(String(item.status || '')) && now - millis(item.sentAt || item.createdAt) < timeoutMs)
    if (stillWaiting && !force) {
      await requestRef.set({ externalDispatchLockUntil: null }, { merge: true })
      return { ok: true, skipped: true, reason: 'waiting_for_replies' }
    }

    const alreadyTried = new Set(dispatches.filter((item) => String(item.status || '') !== 'send_failed').map((item) => String(item.providerId || '')))
    const providers = providerSnap.docs
      .map((doc) => ({ id: doc.id, ref: doc.ref, ...doc.data() }))
      .filter((provider) => !provider.archived && provider.whatsapp && !alreadyTried.has(provider.id) && areaMatches(provider, request) && categoryMatches(provider, request))
      .sort((a, b) => providerScore(b, request) - providerScore(a, request))

    if (!providers.length) {
      await requestRef.set({
        externalMatchStatus: dispatches.length ? 'no_more_matching_providers' : 'waiting_for_matching_provider',
        externalDispatchLockUntil: null,
        nextExternalDispatchAt: new Date(now + 30 * 60 * 1000),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })
      return { ok: true, sent: 0, reason: 'no_matching_providers' }
    }

    const selected = providers.slice(0, batchSize)
    const prepared = selected.map((provider) => ({ provider, ref: adminDb.collection('externalLeadDispatches').doc(), message: leadMessage(provider, request) }))
    const writeBatch = adminDb.batch()
    prepared.forEach(({ provider, ref, message }) => {
      writeBatch.set(ref, {
        requestId,
        providerId: provider.id,
        providerName: provider.businessName || 'External provider',
        providerWhatsapp: String(provider.whatsapp).replace(/\D/g, ''),
        status: 'sending',
        preparedMessage: message,
        automated: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
    })
    await writeBatch.commit()

    const results = await Promise.all(prepared.map(async ({ provider, ref, message }) => {
      try {
        const result = await sendGatewayMessage(provider.whatsapp, message)
        await Promise.all([
          ref.set({ status: 'awaiting_reply', sentAt: FieldValue.serverTimestamp(), gatewayMessageId: result.messageId || null, updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
          provider.ref.set({ lastContactedAt: FieldValue.serverTimestamp(), lastDispatchId: ref.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
        ])
        return { ok: true, providerId: provider.id }
      } catch (error) {
        await ref.set({ status: 'send_failed', sendError: error instanceof Error ? error.message : String(error), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
        return { ok: false, providerId: provider.id }
      }
    }))

    const sent = results.filter((item) => item.ok).length
    const hasMore = providers.length > selected.length
    await requestRef.set({
      externalMatchStatus: sent ? 'provider_contacted' : 'dispatch_failed',
      externalAutoDispatch: true,
      externalLastDispatchAt: FieldValue.serverTimestamp(),
      externalDispatchLockUntil: null,
      nextExternalDispatchAt: sent && hasMore ? new Date(now + timeoutMs) : sent ? new Date(now + timeoutMs) : new Date(now + 2 * 60 * 1000),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })

    return { ok: true, sent, attempted: selected.length, remaining: Math.max(0, providers.length - selected.length) }
  } catch (error) {
    await requestRef.set({ externalDispatchLockUntil: null, externalMatchStatus: 'dispatch_error', externalDispatchError: error instanceof Error ? error.message : String(error), updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => undefined)
    throw error
  }
}

export async function pumpExternalDispatches(limit = 20) {
  const snapshot = await adminDb.collection('requests').where('status', '==', 'open').limit(Math.min(50, Math.max(1, limit))).get()
  const due = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((request) => request.shareContactConsent && request.contactPhone && !request.matchedExternalProviderId && millis(request.nextExternalDispatchAt) <= Date.now())
    .slice(0, limit)

  const results = []
  for (const request of due) {
    try {
      results.push({ requestId: request.id, ...(await dispatchExternalBatch(request.id)) })
    } catch (error) {
      results.push({ requestId: request.id, ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }
  return { checked: snapshot.size, due: due.length, results }
}
