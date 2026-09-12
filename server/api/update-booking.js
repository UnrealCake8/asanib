import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, methodNotAllowed, requireUser, sendError } from './_firebaseAdmin.js'
import { notifyUser } from './_notify.js'

const allowed = new Map([
  ['booked', new Set(['in_progress', 'cancelled'])],
  ['in_progress', new Set(['completed', 'cancelled'])],
  ['completed', new Set()],
  ['cancelled', new Set()],
])

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    const user = await requireUser(req)
    const bookingId = String(req.body?.bookingId || '').trim()
    const status = String(req.body?.status || '').trim()
    if (!bookingId || !allowed.has(status)) return res.status(400).json({ error: 'Invalid booking update.' })

    const ref = adminDb.collection('bookings').doc(bookingId)
    const snap = await ref.get()
    if (!snap.exists || snap.data().providerId !== user.uid) return res.status(403).json({ error: 'You cannot update this booking.' })
    const current = String(snap.data().status)
    if (!allowed.get(current)?.has(status)) return res.status(409).json({ error: `Cannot move booking from ${current} to ${status}.` })

    await ref.update({ status, updatedAt: FieldValue.serverTimestamp() })
    const requestRef = adminDb.collection('requests').doc(String(snap.data().requestId))
    if (status === 'completed') await requestRef.update({ status: 'completed', completedAt: FieldValue.serverTimestamp() })

    const copy = status === 'in_progress'
      ? `${snap.data().providerName} marked your job as in progress.`
      : status === 'completed'
        ? `${snap.data().providerName} marked your job complete. You can now leave a review.`
        : `${snap.data().providerName} cancelled the booking.`
    await notifyUser(String(snap.data().customerId), 'Booking update', copy, '/')

    return res.status(200).json({ ok: true })
  } catch (error) {
    return sendError(res, error)
  }
}
