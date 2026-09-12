import { randomUUID } from 'node:crypto'
import { methodNotAllowed, requireUser, sendError } from './_firebaseAdmin.js'
import { createR2UploadUrl } from './_r2.js'

const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
const documentTypes = new Map([
  ['trade_license', 'trade-licence'],
  ['emirates_id_front', 'emirates-id-front'],
  ['emirates_id_back', 'emirates-id-back'],
])

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
    const documentType = String(req.body?.documentType || 'trade_license').trim()
    const prefix = documentTypes.get(documentType)

    if (!prefix) return res.status(400).json({ error: 'Invalid verification document type.' })
    if (!allowedTypes.has(contentType)) return res.status(400).json({ error: 'Upload a PDF, JPG, PNG or WebP verification document.' })
    if (!Number.isFinite(size) || size <= 0 || size > 10 * 1024 * 1024) return res.status(400).json({ error: 'Verification documents must be smaller than 10 MB.' })

    const key = `kyb/${user.uid}/${prefix}-${randomUUID()}.${extensionFor(contentType)}`
    const uploadUrl = await createR2UploadUrl({ key, contentType })
    return res.status(200).json({ uploadUrl, key, documentType, expiresIn: 600 })
  } catch (error) {
    return sendError(res, error)
  }
}
