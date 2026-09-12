import { adminDb, methodNotAllowed, requireAdmin, sendError } from './_firebaseAdmin.js'
import { createR2ReadUrl, r2ObjectExists } from './_r2.js'

const documentFields = new Map([
  ['trade_license', ['tradeLicensePath', 'Trade licence']],
  ['emirates_id_front', ['emiratesIdFrontPath', 'Emirates ID front']],
  ['emirates_id_back', ['emiratesIdBackPath', 'Emirates ID back']],
])

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    await requireAdmin(req)
    const providerId = String(req.body?.providerId || '').trim()
    const documentType = String(req.body?.documentType || 'trade_license').trim()
    const config = documentFields.get(documentType)
    if (!providerId) return res.status(400).json({ error: 'Provider is required.' })
    if (!config) return res.status(400).json({ error: 'Invalid verification document type.' })

    const snap = await adminDb.collection('providers').doc(providerId).get()
    if (!snap.exists) return res.status(404).json({ error: 'Provider not found.' })
    const [field, label] = config
    const key = String(snap.data()?.[field] || '')
    if (!key || !key.startsWith(`kyb/${providerId}/`)) return res.status(404).json({ error: `${label} document not found.` })

    if (!await r2ObjectExists(key)) return res.status(404).json({ error: `${label} document not found.` })
    const url = await createR2ReadUrl({ key, expiresIn: 15 * 60 })
    return res.status(200).json({ url, documentType })
  } catch (error) {
    return sendError(res, error)
  }
}
