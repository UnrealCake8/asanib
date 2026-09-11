import { getMessaging, isSupported, onMessage, onRegistered, onUnregistered, register } from 'firebase/messaging'
import { auth, firebaseApp, firebaseConfigured } from './firebase'

let listenersReady = false
let registrationInFlight: Promise<void> | null = null

async function sendRegistration(fid: string) {
  const user = auth?.currentUser
  if (!user) return
  const token = await user.getIdToken()
  await fetch('/api/register-push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fid }),
  })
}

async function removeRegistration(fid: string) {
  const user = auth?.currentUser
  if (!user) return
  const token = await user.getIdToken()
  await fetch('/api/register-push', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fid }),
  })
}

async function setupListeners() {
  if (listenersReady || !firebaseConfigured || !firebaseApp || !(await isSupported())) return null
  const messaging = getMessaging(firebaseApp)
  onRegistered(messaging, (fid) => { void sendRegistration(fid) })
  onUnregistered(messaging, (fid) => { void removeRegistration(fid) })
  onMessage(messaging, (payload) => {
    window.dispatchEvent(new CustomEvent('asanib:notification', { detail: payload }))
  })
  listenersReady = true
  return messaging
}

export function beginNotificationPermissionRequest(): Promise<NotificationPermission> | null {
  if (!('Notification' in window)) return null
  if (Notification.permission !== 'default') return Promise.resolve(Notification.permission)
  return Notification.requestPermission()
}

export async function syncPushRegistration(permissionPromise?: Promise<NotificationPermission> | null) {
  if (!firebaseConfigured || !firebaseApp || !auth?.currentUser) return
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return
  const permission = permissionPromise ? await permissionPromise : Notification.permission
  if (permission !== 'granted') return

  if (registrationInFlight) return registrationInFlight
  registrationInFlight = (async () => {
    const messaging = await setupListeners()
    if (!messaging) return
    const serviceWorkerRegistration = await navigator.serviceWorker.ready
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
    await register(messaging, {
      serviceWorkerRegistration,
      ...(vapidKey ? { vapidKey } : {}),
    })
  })().finally(() => { registrationInFlight = null })
  return registrationInFlight
}

export async function syncPushIfAlreadyAllowed() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  await syncPushRegistration()
}
