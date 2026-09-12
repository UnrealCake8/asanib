import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, methodNotAllowed, requireUser, sendError } from './_firebaseAdmin.js'
import { r2ObjectExists } from './_r2.js'

function clean(value, max = 300) {
  return String(value || '').trim().slice(0, max)
}

function bookingAmountFils(booking) {
  const explicit = Number(booking?.paymentAmountFils)
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit)
  const amount = Number(booking?.amount)
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0
}

function safeHttpsUrl(value) {
  const raw = clean(value, 700)
  if (!raw) throw Object.assign(new Error('Enter a payment link.'), { statusCode: 400 })
  let url
  try { url = new URL(raw) } catch { throw Object.assign(new Error('Enter a valid payment link.'), { statusCode: 400 }) }
  if (url.protocol !== 'https:') throw Object.assign(new Error('Payment links must use HTTPS.'), { statusCode: 400 })
  const host = url.hostname.toLowerCase()
  if (!host || host === 'localhost' || host.endsWith('.local') || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    throw Object.assign(new Error('That payment link destination is not allowed.'), { statusCode: 400 })
  }
  url.hash = ''
  return url.toString()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    const user = await requireUser(req)
    const method = clean(req.body?.method, 30)
    if (!['bank', 'payment_link'].includes(method)) return res.status(400).json({ error: 'Choose bank transfer or custom payment link.' })

    const providerRef = adminDb.collection('providers').doc(user.uid)
    const providerSnap = await providerRef.get()
    if (!providerSnap.exists) return res.status(404).json({ error: 'Provider profile not found.' })
    const provider = providerSnap.data() || {}
    if (provider.kybStatus !== 'verified' || provider.approved !== true) return res.status(403).json({ error: 'Business verification is required before payouts.' })

    let destination = {}
    let destinationLabel = ''
    if (method === 'bank') {
      const bankAccountHolder = clean(req.body?.bankAccountHolder, 160)
      const bankName = clean(req.body?.bankName, 140)
      const bankIban = clean(req.body?.bankIban, 80).replace(/\s+/g, '').toUpperCase()
      const bankProofPath = clean(req.body?.bankProofPath, 500) || provider.bankProofPath || ''
      if (!bankAccountHolder || !bankName || !/^AE\d{21}$/.test(bankIban)) return res.status(400).json({ error: 'Enter the account holder, bank name and a valid UAE IBAN.' })
      if (!bankProofPath.startsWith(`payouts/${user.uid}/`)) return res.status(400).json({ error: 'Upload proof that this bank account exists.' })
      if (!await r2ObjectExists(bankProofPath)) return res.status(400).json({ error: 'Bank proof upload could not be verified.' })
      destination = { bankAccountHolder, bankName, bankIban, bankProofPath }
      destinationLabel = `${bankName} · ${bankIban.slice(-4)}`
      await providerRef.set({ payoutMethod: method, ...destination, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    } else {
      const payoutPaymentLink = safeHttpsUrl(req.body?.payoutPaymentLink || provider.payoutPaymentLink)
      destination = { payoutPaymentLink }
      destinationLabel = new URL(payoutPaymentLink).hostname.toLowerCase()
      await providerRef.set({ payoutMethod: method, payoutPaymentLink, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    }

    const bookingsSnap = await adminDb.collection('bookings').where('providerId', '==', user.uid).get()
    const eligibleRefs = bookingsSnap.docs
      .filter((doc) => {
        const booking = doc.data()
        return booking.paymentStatus === 'paid' && booking.status === 'completed' && !booking.payoutId && booking.payoutState !== 'pending' && booking.payoutState !== 'paid'
      })
      .slice(0, 200)

    if (!eligibleRefs.length) return res.status(400).json({ error: 'There is no available balance to cash out yet.' })

    const payoutRef = adminDb.collection('providerPayouts').doc()
    let amountFils = 0
    const bookingIds = []

    await adminDb.runTransaction(async (tx) => {
      for (const docSnap of eligibleRefs) {
        const fresh = await tx.get(docSnap.ref)
        if (!fresh.exists) continue
        const booking = fresh.data()
        if (booking.providerId !== user.uid || booking.paymentStatus !== 'paid' || booking.status !== 'completed' || booking.payoutId || booking.payoutState === 'pending' || booking.payoutState === 'paid') continue
        const fils = bookingAmountFils(booking)
        if (fils <= 0) continue
        amountFils += fils
        bookingIds.push(fresh.id)
        tx.set(fresh.ref, { payoutId: payoutRef.id, payoutState: 'pending', payoutReservedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
      }
      if (!bookingIds.length || amountFils <= 0) throw Object.assign(new Error('Your available balance changed. Refresh and try again.'), { statusCode: 409 })
      tx.set(payoutRef, {
        providerId: user.uid,
        providerName: provider.businessName || null,
        amountFils,
        currency: 'AED',
        method,
        destination,
        destinationLabel,
        bookingIds,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
    })

    return res.status(201).json({ id: payoutRef.id, amountFils, status: 'pending', method, destinationLabel })
  } catch (error) {
    return sendError(res, error)
  }
}
