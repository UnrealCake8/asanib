import { randomUUID } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, methodNotAllowed, requireUser, sendError } from './_firebaseAdmin.js'
import { getProviderZiinaToken, ziinaApi } from './_ziina.js'

function originFromReq(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https')
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
  return `${proto}://${host}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    const user = await requireUser(req)
    const bookingId = String(req.body?.bookingId || '').trim()
    if (!bookingId) return res.status(400).json({ error: 'Booking is required.' })

    const bookingRef = adminDb.collection('bookings').doc(bookingId)
    const bookingSnap = await bookingRef.get()
    if (!bookingSnap.exists) return res.status(404).json({ error: 'Booking not found.' })
    const booking = bookingSnap.data()
    if (booking.customerId !== user.uid) return res.status(403).json({ error: 'You cannot pay for this booking.' })
    if (!['booked', 'in_progress'].includes(String(booking.status || ''))) return res.status(409).json({ error: 'This booking cannot be paid right now.' })
    if (booking.paymentStatus === 'paid') return res.status(409).json({ error: 'This booking is already paid.' })

    const amountFils = Math.round(Number(booking.amount || 0) * 100)
    if (!Number.isInteger(amountFils) || amountFils < 200) return res.status(400).json({ error: 'Booking amount is invalid.' })

    if (booking.ziinaPaymentIntentId) {
      const existingPayment = await adminDb.collection('asanibPayments').doc(String(booking.ziinaPaymentIntentId)).get()
      if (existingPayment.exists && !['failed', 'canceled'].includes(String(existingPayment.data()?.status || ''))) {
        return res.status(200).json({
          paymentIntentId: existingPayment.id,
          embeddedUrl: existingPayment.data()?.embeddedUrl,
          status: existingPayment.data()?.status || 'requires_payment_instrument',
          amountFils,
          providerName: booking.providerName,
        })
      }
    }

    const token = await getProviderZiinaToken(String(booking.providerId))
    const origin = originFromReq(req)
    const operationId = randomUUID()
    const payment = await ziinaApi('/payment_intent', token, {
      method: 'POST',
      body: JSON.stringify({
        amount: amountFils,
        currency_code: 'AED',
        message: `Asanib booking ${bookingId.slice(0, 8)} · ${String(booking.providerName || 'Provider').slice(0, 80)}`,
        success_url: `${origin}/checkout/${bookingId}?payment=success&id={PAYMENT_INTENT_ID}`,
        cancel_url: `${origin}/checkout/${bookingId}?payment=cancelled&id={PAYMENT_INTENT_ID}`,
        failure_url: `${origin}/checkout/${bookingId}?payment=failed&id={PAYMENT_INTENT_ID}`,
        test: process.env.ZIINA_TEST_MODE === 'true',
        allow_tips: false,
        operation_id: operationId,
      }),
    })

    if (!payment?.id || !payment?.embedded_url) throw Object.assign(new Error('Ziina did not return embedded checkout details.'), { statusCode: 502 })

    const paymentRef = adminDb.collection('asanibPayments').doc(String(payment.id))
    await adminDb.runTransaction(async (tx) => {
      tx.set(paymentRef, {
        bookingId,
        customerId: user.uid,
        providerId: booking.providerId,
        providerName: booking.providerName,
        amountFils,
        currency: 'AED',
        status: payment.status || 'requires_payment_instrument',
        operationId,
        embeddedUrl: payment.embedded_url,
        accountId: payment.account_id || null,
        test: process.env.ZIINA_TEST_MODE === 'true',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      tx.set(bookingRef, {
        ziinaPaymentIntentId: String(payment.id),
        paymentProcessor: 'ziina',
        paymentStatus: payment.status || 'requires_payment_instrument',
        paymentAmountFils: amountFils,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })
    })

    return res.status(200).json({
      paymentIntentId: payment.id,
      embeddedUrl: payment.embedded_url,
      status: payment.status || 'requires_payment_instrument',
      amountFils,
      providerName: booking.providerName,
    })
  } catch (error) {
    return sendError(res, error)
  }
}
