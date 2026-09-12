import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, methodNotAllowed, requireUser, sendError } from './_firebaseAdmin.js'

export default async function handler(req, res) {
  if (!['POST', 'DELETE'].includes(req.method)) return methodNotAllowed(res)
  try {
    const user = await requireUser(req)
    const fid = String(req.body?.fid || '').trim()
    if (!fid || fid.length > 256 || fid.includes('/')) return res.status(400).json({ error: 'Invalid Firebase installation ID.' })
    const ref = adminDb.collection('users').doc(user.uid).collection('pushRegistrations').doc(fid)
    if (req.method === 'DELETE') {
      await ref.delete()
      return res.status(204).end()
    }
    await ref.set({
      fid,
      updatedAt: FieldValue.serverTimestamp(),
      userAgent: String(req.headers['user-agent'] || '').slice(0, 400),
    }, { merge: true })
    return res.status(200).json({ ok: true })
  } catch (error) {
    return sendError(res, error)
  }
}
