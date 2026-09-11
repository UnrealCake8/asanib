import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, methodNotAllowed, requireUser, sendError } from './_firebaseAdmin.js'
import { notifyUser } from './_notify.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    const user = await requireUser(req)
    const requestId = String(req.body?.requestId || '').trim()
    const amount = Number(req.body?.amount)
    const etaMinutes = req.body?.etaMinutes == null || req.body?.etaMinutes === '' ? null : Number(req.body.etaMinutes)
    const message = String(req.body?.message || '').trim().slice(0, 500) || null
    if (!requestId || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Enter a valid quote amount.' })
    if (etaMinutes != null && (!Number.isFinite(etaMinutes) || etaMinutes < 0 || etaMinutes > 10080)) return res.status(400).json({ error: 'Invalid ETA.' })

    const [providerSnap, matchSnap, requestSnap] = await Promise.all([
      adminDb.collection('providers').doc(user.uid).get(),
      adminDb.collection('providerMatches').doc(user.uid).collection('requests').doc(requestId).get(),
      adminDb.collection('requests').doc(requestId).get(),
    ])
    if (!providerSnap.exists || providerSnap.data()?.approved !== true) return res.status(403).json({ error: 'Provider approval required.' })
    if (!matchSnap.exists) return res.status(403).json({ error: 'This request was not matched to your provider account.' })
    if (!requestSnap.exists || requestSnap.data()?.status !== 'open') return res.status(409).json({ error: 'This request is no longer open.' })

    const provider = providerSnap.data()
    const duplicate = await adminDb.collection('quotes')
      .where('requestId', '==', requestId)
      .where('providerId', '==', user.uid)
      .limit(1)
      .get()
    if (!duplicate.empty) return res.status(409).json({ error: 'You already sent a quote for this request.' })

    const quoteRef = adminDb.collection('quotes').doc()
    await quoteRef.set({
      requestId,
      providerId: user.uid,
      providerName: String(provider.businessName || 'Provider'),
      providerPhone: String(provider.phone || ''),
      providerWhatsapp: provider.whatsapp ? String(provider.whatsapp) : null,
      amount,
      etaMinutes,
      message,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    })

    await notifyUser(
      String(requestSnap.data().customerId),
      'New quote on Asanib',
      `${provider.businessName || 'A provider'} quoted AED ${amount}${etaMinutes != null ? ` · ETA ${etaMinutes} min` : ''}`,
      `/request/${requestId}`,
    )

    return res.status(201).json({ id: quoteRef.id })
  } catch (error) {
    return sendError(res, error)
  }
}
