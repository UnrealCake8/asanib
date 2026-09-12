import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, methodNotAllowed, requireUser, sendError } from './_firebaseAdmin.js'
import { notifyUser } from './_notify.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    const user = await requireUser(req)
    const requestId = String(req.body?.requestId || '').trim()
    const quoteId = String(req.body?.quoteId || '').trim()
    if (!requestId || !quoteId) return res.status(400).json({ error: 'Request and quote are required.' })

    const bookingRef = adminDb.collection('bookings').doc()
    const outcome = await adminDb.runTransaction(async (tx) => {
      const requestRef = adminDb.collection('requests').doc(requestId)
      const quoteRef = adminDb.collection('quotes').doc(quoteId)
      const [requestSnap, quoteSnap] = await Promise.all([tx.get(requestRef), tx.get(quoteRef)])
      if (!requestSnap.exists || requestSnap.data().customerId !== user.uid) throw Object.assign(new Error('You cannot book this request.'), { statusCode: 403 })
      if (requestSnap.data().status !== 'open') throw Object.assign(new Error('This request is no longer open.'), { statusCode: 409 })
      if (!quoteSnap.exists || quoteSnap.data().requestId !== requestId || quoteSnap.data().status !== 'pending') throw Object.assign(new Error('This quote is no longer available.'), { statusCode: 409 })
      const quote = quoteSnap.data()
      tx.update(requestRef, { status: 'booked', acceptedQuoteId: quoteId, bookedAt: FieldValue.serverTimestamp() })
      tx.update(quoteRef, { status: 'accepted', acceptedAt: FieldValue.serverTimestamp() })
      tx.set(bookingRef, {
        requestId,
        customerId: user.uid,
        providerId: quote.providerId,
        providerName: quote.providerName,
        providerPhone: quote.providerPhone || null,
        providerWhatsapp: quote.providerWhatsapp || null,
        quoteId,
        amount: quote.amount,
        checkoutUrl: quote.checkoutUrl || null,
        checkoutProvider: quote.checkoutProvider || null,
        checkoutHost: quote.checkoutHost || null,
        paymentStatus: 'not_started',
        status: 'booked',
        createdAt: FieldValue.serverTimestamp(),
      })
      return {
        providerId: quote.providerId,
        providerName: quote.providerName,
        checkoutUrl: quote.checkoutUrl || null,
        checkoutProvider: quote.checkoutProvider || null,
        checkoutHost: quote.checkoutHost || null,
      }
    })

    const otherQuotes = await adminDb.collection('quotes').where('requestId', '==', requestId).get()
    const batch = adminDb.batch()
    otherQuotes.docs.forEach((doc) => {
      if (doc.id !== quoteId && doc.data().status === 'pending') batch.update(doc.ref, { status: 'withdrawn', withdrawnAt: FieldValue.serverTimestamp() })
    })
    await batch.commit()

    const ziinaSnap = await adminDb.collection('providerZiinaConnections').doc(outcome.providerId).get()
    const asanibCheckoutAvailable = ziinaSnap.exists && ziinaSnap.data()?.accountStatus === 'active'

    await notifyUser(outcome.providerId, 'Your Asanib quote was accepted', 'The customer booked your quote. Open Asanib to view the job.', '/provider')
    return res.status(200).json({ bookingId: bookingRef.id, asanibCheckoutAvailable, ...outcome })
  } catch (error) {
    return sendError(res, error)
  }
}
