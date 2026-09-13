import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, methodNotAllowed, requireAdmin, sendError } from './_firebaseAdmin.js'

function clean(value, max = 160) { return String(value || '').trim().slice(0, max) }
function timingLabel(request) {
  if (request.urgency === 'now') return 'Needed now'
  if (request.urgency === 'today') return 'Needed today'
  return request.scheduledFor || 'Scheduled'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    const admin = await requireAdmin(req)
    const requestId = clean(req.body?.requestId)
    const providerId = clean(req.body?.providerId)
    if (!requestId || !providerId) return res.status(400).json({ error: 'requestId and providerId are required.' })

    const requestRef = adminDb.collection('requests').doc(requestId)
    const providerRef = adminDb.collection('externalProviders').doc(providerId)
    const [requestSnap, providerSnap] = await Promise.all([requestRef.get(), providerRef.get()])
    if (!requestSnap.exists || !providerSnap.exists) return res.status(404).json({ error: 'Request or provider not found.' })
    const request = { id: requestSnap.id, ...requestSnap.data() }
    const provider = { id: providerSnap.id, ...providerSnap.data() }
    if (provider.leadOptIn === false) return res.status(409).json({ error: 'This business has opted out of Asanib messages.' })
    if (request.status !== 'open') return res.status(409).json({ error: 'Only open requests can be matched.' })

    const greeting = provider.businessName ? `Hi ${provider.businessName}, I'm from Asanib.` : `Hi, I'm from Asanib.`
    const message = [
      greeting,
      '',
      'We help people in the UAE find local businesses when they need something done.',
      '',
      `A customer in ${request.location} is looking for help with:`,
      request.query,
      request.budget ? `Budget: AED ${request.budget}` : null,
      `Timing: ${timingLabel(request)}`,
      '',
      'There is no fee or commission for you. You deal with the customer directly and keep 100% of what they pay.',
      '',
      'If you are interested, reply YES and Asanib will send the customer details.',
      '',
      'You can also register your business free at https://asanib.com/provider. Registration is optional.',
      '',
      'Reply STOP if you do not want Asanib to contact you again.',
    ].filter((line) => line !== null).join('\n')

    const dispatchRef = adminDb.collection('externalLeadDispatches').doc()
    const batch = adminDb.batch()
    batch.set(dispatchRef, {
      requestId,
      providerId,
      providerName: provider.businessName || 'External provider',
      providerWhatsapp: provider.whatsapp,
      status: 'awaiting_reply',
      preparedMessage: message,
      createdAt: FieldValue.serverTimestamp(),
      sentAt: FieldValue.serverTimestamp(),
      createdBy: admin.uid,
    })
    batch.set(providerRef, { lastContactedAt: FieldValue.serverTimestamp(), lastDispatchId: dispatchRef.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    batch.set(requestRef, { externalMatchStatus: 'provider_contacted', externalLastDispatchId: dispatchRef.id, externalLastProviderId: providerId, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    await batch.commit()

    const digits = String(provider.whatsapp || '').replace(/\D/g, '')
    return res.json({ ok: true, dispatchId: dispatchRef.id, message, whatsappUrl: `https://wa.me/${digits}?text=${encodeURIComponent(message)}` })
  } catch (error) {
    return sendError(res, error)
  }
}
