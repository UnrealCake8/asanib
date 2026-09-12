import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, methodNotAllowed, requireAdmin, sendError } from './_firebaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    await requireAdmin(req)
    const payoutId = String(req.body?.payoutId || '').trim()
    const action = String(req.body?.action || '').trim()
    const note = String(req.body?.note || '').trim().slice(0, 500) || null
    if (!payoutId || !['mark_processing', 'mark_paid', 'reject'].includes(action)) return res.status(400).json({ error: 'Invalid payout action.' })

    const payoutRef = adminDb.collection('providerPayouts').doc(payoutId)
    await adminDb.runTransaction(async (tx) => {
      const payoutSnap = await tx.get(payoutRef)
      if (!payoutSnap.exists) throw Object.assign(new Error('Payout not found.'), { statusCode: 404 })
      const payout = payoutSnap.data() || {}
      const bookingIds = Array.isArray(payout.bookingIds) ? payout.bookingIds.map(String).slice(0, 200) : []
      const bookingRefs = bookingIds.map((id) => adminDb.collection('bookings').doc(id))
      const bookings = []
      for (const ref of bookingRefs) bookings.push(await tx.get(ref))

      if (action === 'mark_processing') {
        tx.set(payoutRef, { status: 'processing', reviewNote: note, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
        return
      }

      if (action === 'mark_paid') {
        tx.set(payoutRef, { status: 'paid', reviewNote: note, paidAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
        bookings.forEach((booking) => {
          if (booking.exists && booking.data()?.payoutId === payoutId) tx.set(booking.ref, { payoutState: 'paid', paidOutAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
        })
        return
      }

      tx.set(payoutRef, { status: 'rejected', reviewNote: note, rejectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
      bookings.forEach((booking) => {
        if (booking.exists && booking.data()?.payoutId === payoutId) tx.set(booking.ref, { payoutId: FieldValue.delete(), payoutState: FieldValue.delete(), payoutReservedAt: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
      })
    })

    return res.status(200).json({ ok: true })
  } catch (error) {
    return sendError(res, error)
  }
}
