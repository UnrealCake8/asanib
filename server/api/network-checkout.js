import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, methodNotAllowed, requireUser, sendError } from './_firebaseAdmin.js'
import { paymentFlowEnabled } from './_payments.js'
import { createNetworkOrder, networkInternationalConfig, validPaymentUrl } from './_networkInternational.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  let claimedBookingRef = null
  try {
    if (!paymentFlowEnabled()) return res.status(503).json({ error: 'JSV Market checkout is not enabled.' })
    const user = await requireUser(req)
    const bookingId = String(req.body?.bookingId || '').trim()
    if (!bookingId) return res.status(400).json({ error: 'Booking is required.' })

    if (!user.email) return res.status(409).json({ error: 'Sign in with an email address before paying online.' })
    const appUrl = String(process.env.JSV_MARKET_APP_URL || '').replace(/\/$/, '')
    if (!appUrl.startsWith('https://')) throw Object.assign(new Error('JSV_MARKET_APP_URL must be an HTTPS URL.'), { statusCode: 503 })
    const { environment } = networkInternationalConfig()

    const bookingRef = adminDb.collection('bookings').doc(bookingId)
    const booking = await adminDb.runTransaction(async (tx) => {
      const bookingSnap = await tx.get(bookingRef)
      if (!bookingSnap.exists || bookingSnap.data().customerId !== user.uid) throw Object.assign(new Error('You cannot pay for this booking.'), { statusCode: 403 })
      const value = bookingSnap.data()
      if (value.status === 'cancelled') throw Object.assign(new Error('This booking is cancelled.'), { statusCode: 409 })
      if (value.paymentStatus === 'paid') throw Object.assign(new Error('This booking is already paid.'), { statusCode: 409 })
      if (value.networkOrderReference && value.paymentStatus === 'pending' && validPaymentUrl(value.networkPaymentUrl, environment)) return { ...value, existingPaymentUrl: value.networkPaymentUrl }
      if (value.paymentCreationStatus === 'creating') throw Object.assign(new Error('Checkout is already being prepared.'), { statusCode: 409 })
      tx.update(bookingRef, { paymentCreationStatus: 'creating', paymentUpdatedAt: FieldValue.serverTimestamp() })
      return value
    })
    if (booking.existingPaymentUrl) return res.status(200).json({ paymentUrl: booking.existingPaymentUrl })
    claimedBookingRef = bookingRef

    const { paymentUrl, reference } = await createNetworkOrder({
      amount: booking.amount,
      emailAddress: String(user.email || '').trim(),
      redirectUrl: `${appUrl}/checkout/complete?bookingId=${encodeURIComponent(bookingId)}`,
      merchantOrderReference: bookingId,
    })

    const paymentRef = adminDb.collection('jsvMarketPayments').doc(reference)
    await Promise.all([
      paymentRef.set({
        bookingId,
        customerId: user.uid,
        providerId: booking.providerId,
        amount: Number(booking.amount),
        currency: 'AED',
        processor: 'network_international',
        environment,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }),
      bookingRef.update({
        networkOrderReference: reference,
        networkPaymentUrl: paymentUrl,
        paymentProcessor: 'network_international',
        paymentCreationStatus: 'ready',
        paymentStatus: 'pending',
        paymentUpdatedAt: FieldValue.serverTimestamp(),
      }),
    ])
    return res.status(200).json({ paymentUrl })
  } catch (error) {
    if (claimedBookingRef) await claimedBookingRef.update({ paymentCreationStatus: 'failed', paymentUpdatedAt: FieldValue.serverTimestamp() }).catch(() => {})
    return sendError(res, error)
  }
}
