import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, methodNotAllowed, requireUser, sendError } from './_firebaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    const user = await requireUser(req)
    const requestId = String(req.body?.requestId || '').trim()
    if (!requestId) return res.status(400).json({ error: 'Request is required.' })
    const ref = adminDb.collection('requests').doc(requestId)
    const snap = await ref.get()
    if (!snap.exists || snap.data().customerId !== user.uid) return res.status(403).json({ error: 'You cannot cancel this request.' })
    if (snap.data().status !== 'open') return res.status(409).json({ error: 'Only open requests can be cancelled.' })
    await ref.update({ status: 'cancelled', cancelledAt: FieldValue.serverTimestamp() })

    const matches = await adminDb.collectionGroup('requests').where('requestId', '==', requestId).get()
    const batch = adminDb.batch()
    matches.docs.forEach((doc) => batch.update(doc.ref, { status: 'cancelled', updatedAt: FieldValue.serverTimestamp() }))
    if (!matches.empty) await batch.commit()

    return res.status(200).json({ ok: true })
  } catch (error) {
    return sendError(res, error)
  }
}
