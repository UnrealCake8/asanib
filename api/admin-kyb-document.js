import { adminDb, adminStorage, methodNotAllowed, requireAdmin, sendError } from './_firebaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    await requireAdmin(req)
    const providerId = String(req.body?.providerId || '').trim()
    if (!providerId) return res.status(400).json({ error: 'Provider is required.' })

    const snap = await adminDb.collection('providers').doc(providerId).get()
    if (!snap.exists) return res.status(404).json({ error: 'Provider not found.' })
    const path = String(snap.data()?.tradeLicensePath || '')
    if (!path || !path.startsWith(`kyb/${providerId}/`)) return res.status(404).json({ error: 'Trade licence document not found.' })

    const bucket = adminStorage.bucket()
    const file = bucket.file(path)
    const [exists] = await file.exists()
    if (!exists) return res.status(404).json({ error: 'Trade licence document not found.' })
    const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60 * 1000 })
    return res.status(200).json({ url })
  } catch (error) {
    return sendError(res, error)
  }
}
