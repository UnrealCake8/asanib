import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

function getAdminApp() {
  if (getApps().length) return getApps()[0]
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) throw new Error('Firebase Admin environment variables are not configured.')
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

export const adminApp = getAdminApp()
export const adminAuth = getAuth(adminApp)
export const adminDb = getFirestore(adminApp)
export const adminMessaging = getMessaging(adminApp)

export async function requireUser(req) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) throw Object.assign(new Error('Authentication required.'), { statusCode: 401 })
  return adminAuth.verifyIdToken(token)
}

export async function requireAdmin(req) {
  const user = await requireUser(req)
  const admin = await adminDb.collection('admins').doc(user.uid).get()
  if (!admin.exists) throw Object.assign(new Error('Admin access required.'), { statusCode: 403 })
  return user
}

export function sendError(res, error) {
  const status = Number(error?.statusCode || 500)
  res.status(status).json({ error: error instanceof Error ? error.message : 'Server error.' })
}

export function methodNotAllowed(res) {
  res.setHeader('Allow', 'POST')
  res.status(405).json({ error: 'Method not allowed.' })
}
