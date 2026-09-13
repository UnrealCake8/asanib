import crypto from 'node:crypto'
import { methodNotAllowed, sendError } from './_firebaseAdmin.js'
import { pumpExternalDispatches } from './_externalDispatch.js'

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''))
  const right = Buffer.from(String(b || ''))
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function requireSecret(req) {
  const expected = String(process.env.ASANIB_WEBHOOK_SECRET || '').trim()
  if (!expected) throw Object.assign(new Error('ASANIB_WEBHOOK_SECRET is not configured.'), { statusCode: 503 })
  const header = String(req.headers.authorization || '')
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token || !safeEqual(token, expected)) throw Object.assign(new Error('Unauthorized.'), { statusCode: 401 })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    requireSecret(req)
    const result = await pumpExternalDispatches(20)
    return res.json({ ok: true, ...result })
  } catch (error) {
    return sendError(res, error)
  }
}
