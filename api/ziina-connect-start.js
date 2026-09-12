import { randomUUID } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, methodNotAllowed, requireUser, sendError } from './_firebaseAdmin.js'
import { buildAuthorizeUrl, ziinaConfigured } from './_ziina.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    if (!ziinaConfigured()) return res.status(503).json({ error: 'Ziina Connect is not configured yet.' })
    const user = await requireUser(req)
    const provider = await adminDb.collection('providers').doc(user.uid).get()
    if (!provider.exists) return res.status(404).json({ error: 'Provider profile not found.' })
    if (provider.data()?.kybStatus !== 'verified') return res.status(409).json({ error: 'Complete Asanib business verification before connecting Ziina Checkout.' })

    const state = randomUUID()
    await adminDb.collection('ziinaOAuthStates').doc(state).set({
      providerId: user.uid,
      createdAt: FieldValue.serverTimestamp(),
      expiresAtMs: Date.now() + 10 * 60 * 1000,
    })
    return res.status(200).json({ authorizationUrl: buildAuthorizeUrl(state) })
  } catch (error) {
    return sendError(res, error)
  }
}
