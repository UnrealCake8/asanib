import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, methodNotAllowed, requireUser, sendError } from './_firebaseAdmin.js'
import { paymentStatus, retrieveNetworkOrder } from './_networkInternational.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    const user = await requireUser(req)
    const bookingId = String(req.body?.bookingId || '').trim()
    const bookingRef = adminDb.collection('bookings').doc(bookingId)
    const bookingSnap = await bookingRef.get()
    if (!bookingSnap.exists || bookingSnap.data().customerId !== user.uid) {
      return res.status(403).json({ error: 'You cannot view this payment.' })
    }
    const reference = String(bookingSnap.data().networkOrderReference || '')
    if (!reference) return res.status(404).json({ error: 'No JSV Market payment exists for this booking.' })
    const order = await retrieveNetworkOrder(reference)
    const status = paymentStatus(order)
    await Promise.all([
      bookingRef.update({ paymentStatus: status, paymentUpdatedAt: FieldValue.serverTimestamp() }),
      adminDb.collection('jsvMarketPayments').doc(reference).set({ status, updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
    ])
    return res.status(200).json({ status })
  } catch (error) {
    return sendError(res, error)
  }
}
