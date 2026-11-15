import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, sendError } from './_firebaseAdmin.js'
import { networkInternationalConfig, orderReference, paymentStatus, toMinorUnits } from './_networkInternational.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  try {
    const expected = String(process.env.NETWORK_INTERNATIONAL_WEBHOOK_TOKEN || '').trim()
    const received = String(req.headers['x-jsv-market-webhook-token'] || '').trim()
    if (!expected || received !== expected) return res.status(401).json({ error: 'Invalid webhook token.' })

    const eventId = String(req.body?.eventId || '').trim()
    const reference = orderReference(req.body?.order)
    if (!eventId || !reference) return res.status(400).json({ error: 'Webhook event and order reference are required.' })
    const { outletRef } = networkInternationalConfig()
    if (String(req.body?.outletId || '') !== outletRef) return res.status(401).json({ error: 'Webhook outlet does not match.' })
    const paymentRef = adminDb.collection('jsvMarketPayments').doc(reference)
    const paymentSnap = await paymentRef.get()
    if (!paymentSnap.exists) return res.status(200).json({ ok: true })
    if (Number(req.body?.order?.amount?.value) !== toMinorUnits(paymentSnap.data().amount) || String(req.body?.order?.amount?.currencyCode) !== paymentSnap.data().currency) {
      return res.status(400).json({ error: 'Webhook amount does not match the booking.' })
    }

    const eventRef = adminDb.collection('paymentWebhookEvents').doc(eventId)
    const status = paymentStatus(req.body?.order, req.body?.eventName)
    await adminDb.runTransaction(async (tx) => {
      const existing = await tx.get(eventRef)
      if (existing.exists) return
      tx.create(eventRef, { processor: 'network_international', reference, receivedAt: FieldValue.serverTimestamp() })
      tx.set(paymentRef, { status, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
      tx.update(adminDb.collection('bookings').doc(paymentSnap.data().bookingId), {
        paymentStatus: status,
        paymentUpdatedAt: FieldValue.serverTimestamp(),
      })
    })
    return res.status(200).json({ ok: true })
  } catch (error) {
    return sendError(res, error)
  }
}
