import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, methodNotAllowed, requireUser, sendError } from './_firebaseAdmin.js'
import { getProviderZiinaToken, ziinaApi } from './_ziina.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    const user = await requireUser(req)
    const bookingId = String(req.body?.bookingId || '').trim()
    if (!bookingId) return res.status(400).json({ error: 'Booking is required.' })

    const bookingRef = adminDb.collection('bookings').doc(bookingId)
    const bookingSnap = await bookingRef.get()
    if (!bookingSnap.exists || bookingSnap.data()?.customerId !== user.uid) return res.status(404).json({ error: 'Booking not found.' })
    const booking = bookingSnap.data()
    const paymentIntentId = String(booking.ziinaPaymentIntentId || '')
    if (!paymentIntentId) return res.status(200).json({ status: booking.paymentStatus || 'not_started' })

    const token = await getProviderZiinaToken(String(booking.providerId))
    const payment = await ziinaApi(`/payment_intent/${encodeURIComponent(paymentIntentId)}`, token, { method: 'GET' })
    const status = String(payment.status || 'unknown')
    const paid = status === 'completed'

    await adminDb.runTransaction(async (tx) => {
      tx.set(adminDb.collection('asanibPayments').doc(paymentIntentId), {
        status,
        feeAmount: payment.fee_amount ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })
      tx.set(bookingRef, {
        paymentStatus: paid ? 'paid' : status,
        paidAt: paid ? FieldValue.serverTimestamp() : booking.paidAt || null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })
    })

    return res.status(200).json({ status: paid ? 'paid' : status, paymentIntentId })
  } catch (error) {
    return sendError(res, error)
  }
}
