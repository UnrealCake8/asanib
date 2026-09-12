import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, methodNotAllowed, requireAdmin, sendError } from './_firebaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    const admin = await requireAdmin(req)
    const providerId = String(req.body?.providerId || '').trim()
    const action = String(req.body?.action || '').trim()
    const note = String(req.body?.note || '').trim().slice(0, 500) || null
    if (!providerId) return res.status(400).json({ error: 'Provider is required.' })

    const ref = adminDb.collection('providers').doc(providerId)
    const snap = await ref.get()
    if (!snap.exists) return res.status(404).json({ error: 'Provider not found.' })
    const provider = snap.data()

    if (action === 'verify_kyb') {
      const complete = provider.legalBusinessName && provider.tradeLicenseNumber && provider.licensingAuthority && provider.licenseExpiry && provider.representativeName && provider.representativeConfirmed && provider.tradeLicensePath && provider.emiratesIdFrontPath && provider.emiratesIdBackPath
      if (!complete) return res.status(409).json({ error: 'The provider has not completed all KYB fields and identity documents.' })
      await ref.update({
        kybStatus: 'verified',
        approved: true,
        kybReviewNote: note,
        kybVerifiedAt: FieldValue.serverTimestamp(),
        kybVerifiedBy: admin.uid,
        updatedAt: FieldValue.serverTimestamp(),
      })
    } else if (action === 'reject_kyb') {
      await ref.update({
        kybStatus: 'rejected',
        approved: false,
        kybReviewNote: note,
        kybReviewedAt: FieldValue.serverTimestamp(),
        kybReviewedBy: admin.uid,
        updatedAt: FieldValue.serverTimestamp(),
      })
    } else if (action === 'approve_payment_link') {
      if (!provider.checkoutUrl) return res.status(409).json({ error: 'This provider has no checkout link.' })
      await ref.update({
        paymentLinkStatus: 'approved',
        paymentLinkReviewNote: note,
        paymentLinkReviewedAt: FieldValue.serverTimestamp(),
        paymentLinkReviewedBy: admin.uid,
        updatedAt: FieldValue.serverTimestamp(),
      })
    } else if (action === 'reject_payment_link') {
      await ref.update({
        paymentLinkStatus: 'rejected',
        paymentLinkReviewNote: note,
        paymentLinkReviewedAt: FieldValue.serverTimestamp(),
        paymentLinkReviewedBy: admin.uid,
        updatedAt: FieldValue.serverTimestamp(),
      })
    } else if (action === 'revoke_provider') {
      await ref.update({
        approved: false,
        kybStatus: 'rejected',
        kybReviewNote: note || 'Provider approval revoked by Asanib.',
        updatedAt: FieldValue.serverTimestamp(),
      })
    } else {
      return res.status(400).json({ error: 'Unknown review action.' })
    }

    return res.status(200).json({ ok: true })
  } catch (error) {
    return sendError(res, error)
  }
}
