import { adminDb, methodNotAllowed, requireAdmin, sendError } from './_firebaseAdmin.js'
import { createR2ReadUrl, r2ObjectExists } from './_r2.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    await requireAdmin(req)
    const providerId = String(req.body?.providerId || '').trim()
    if (!providerId) return res.status(400).json({ error: 'Provider is required.' })

    const snap = await adminDb.collection('providers').doc(providerId).get()
    if (!snap.exists) return res.status(404).json({ error: 'Provider not found.' })
    const key = String(snap.data()?.tradeLicensePath || '')
    if (!key || !key.startsWith(`kyb/${providerId}/`)) return res.status(404).json({ error: 'Trade licence document not found.' })

    if (!await r2ObjectExists(key)) return res.status(404).json({ error: 'Trade licence document not found.' })
    const url = await createR2ReadUrl({ key, expiresIn: 15 * 60 })
    return res.status(200).json({ url })
  } catch (error) {
    return sendError(res, error)
  }
}
