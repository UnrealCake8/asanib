import { randomUUID } from 'node:crypto'
import { methodNotAllowed, requireUser, sendError } from './_firebaseAdmin.js'
import { createR2UploadUrl } from './_r2.js'

const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

function extensionFor(type) {
  if (type === 'application/pdf') return 'pdf'
  if (type === 'image/jpeg') return 'jpg'
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return 'bin'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    const user = await requireUser(req)
    const contentType = String(req.body?.contentType || '').toLowerCase().trim()
    const size = Number(req.body?.size || 0)
    if (!allowedTypes.has(contentType)) return res.status(400).json({ error: 'Upload a PDF, JPG, PNG or WebP bank document.' })
    if (!Number.isFinite(size) || size <= 0 || size > 10 * 1024 * 1024) return res.status(400).json({ error: 'Bank proof must be smaller than 10 MB.' })
    const key = `payouts/${user.uid}/bank-proof-${randomUUID()}.${extensionFor(contentType)}`
    const uploadUrl = await createR2UploadUrl({ key, contentType })
    return res.status(200).json({ uploadUrl, key, expiresIn: 600 })
  } catch (error) {
    return sendError(res, error)
  }
}
