import { adminDb, methodNotAllowed, requireUser, sendError } from './_firebaseAdmin.js'

function bookingAmountFils(booking) {
  const explicit = Number(booking?.paymentAmountFils)
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit)
  const amount = Number(booking?.amount)
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    const user = await requireUser(req)
    const [providerSnap, bookingsSnap, payoutsSnap] = await Promise.all([
      adminDb.collection('providers').doc(user.uid).get(),
      adminDb.collection('bookings').where('providerId', '==', user.uid).get(),
      adminDb.collection('providerPayouts').where('providerId', '==', user.uid).get(),
    ])

    if (!providerSnap.exists) return res.status(404).json({ error: 'Provider profile not found.' })

    const paidCompleted = bookingsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((booking) => booking.paymentStatus === 'paid' && booking.status === 'completed')

    const totalEarnedFils = paidCompleted.reduce((sum, booking) => sum + bookingAmountFils(booking), 0)
    const availableBookings = paidCompleted.filter((booking) => !booking.payoutId && booking.payoutState !== 'pending' && booking.payoutState !== 'paid')
    const availableFils = availableBookings.reduce((sum, booking) => sum + bookingAmountFils(booking), 0)

    const payouts = payoutsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const av = a.createdAt?.toMillis?.() || 0
        const bv = b.createdAt?.toMillis?.() || 0
        return bv - av
      })
      .slice(0, 25)
      .map((payout) => ({
        id: payout.id,
        amountFils: Number(payout.amountFils || 0),
        method: payout.method || 'bank',
        status: payout.status || 'pending',
        destinationLabel: payout.destinationLabel || null,
        createdAt: payout.createdAt?.toDate?.()?.toISOString?.() || null,
        updatedAt: payout.updatedAt?.toDate?.()?.toISOString?.() || null,
      }))

    const provider = providerSnap.data() || {}
    return res.status(200).json({
      totalEarnedFils,
      availableFils,
      pendingFils: payouts.filter((payout) => payout.status === 'pending' || payout.status === 'processing').reduce((sum, payout) => sum + payout.amountFils, 0),
      paidOutFils: payouts.filter((payout) => payout.status === 'paid').reduce((sum, payout) => sum + payout.amountFils, 0),
      eligibleBookingCount: availableBookings.length,
      payoutMethod: provider.payoutMethod || null,
      bankAccountHolder: provider.bankAccountHolder || null,
      bankName: provider.bankName || null,
      bankIban: provider.bankIban || null,
      bankProofPath: provider.bankProofPath || null,
      payoutPaymentLink: provider.payoutPaymentLink || null,
      payouts,
    })
  } catch (error) {
    return sendError(res, error)
  }
}
