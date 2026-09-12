import { createHmac, timingSafeEqual } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, sendError } from './_firebaseAdmin.js'

export const config = { api: { bodyParser: false } }

async function readRaw(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

function validSignature(raw, signature, secret) {
  if (!secret || !signature) return false
  const expected = createHmac('sha256', secret).update(raw).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(String(signature))
  return a.length === b.length && timingSafeEqual(a, b)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  try {
    const secret = process.env.ZIINA_WEBHOOK_SECRET
    if (!secret) throw Object.assign(new Error('Ziina webhook secret is not configured.'), { statusCode: 503 })
    const raw = await readRaw(req)
    if (!validSignature(raw, req.headers['x-hmac-signature'], secret)) {
      throw Object.assign(new Error('Invalid Ziina webhook signature.'), { statusCode: 401 })
    }

    const payload = JSON.parse(raw.toString('utf8'))
    if (payload?.event !== 'payment_intent.status.updated') return res.status(200).json({ ok: true })
    const payment = payload?.data || {}
    const paymentIntentId = String(payment.id || '')
    if (!paymentIntentId) return res.status(200).json({ ok: true })

    const paymentRef = adminDb.collection('asanibPayments').doc(paymentIntentId)
    const paymentSnap = await paymentRef.get()
    if (!paymentSnap.exists) return res.status(200).json({ ok: true })
    const data = paymentSnap.data()
    const bookingRef = adminDb.collection('bookings').doc(String(data.bookingId))
    const status = String(payment.status || 'unknown')
    const completed = status === 'completed'

    await adminDb.runTransaction(async (tx) => {
      const bookingSnap = await tx.get(bookingRef)
      const wasPaid = bookingSnap.exists && bookingSnap.data()?.paymentStatus === 'paid'
      tx.set(paymentRef, {
        status,
        feeAmount: payment.fee_amount ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })
      tx.set(bookingRef, {
        paymentStatus: completed ? 'paid' : status,
        paidAt: completed && !wasPaid ? FieldValue.serverTimestamp() : bookingSnap.data()?.paidAt || null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })
    })

    return res.status(200).json({ ok: true })
  } catch (error) {
    return sendError(res, error)
  }
}
