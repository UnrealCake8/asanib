/// <reference lib="webworker" />

import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<unknown> }

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId) {
  const app = initializeApp(firebaseConfig)
  const messaging = getMessaging(app)

  onBackgroundMessage(messaging, (payload) => {
    const title = payload.notification?.title || 'Asanib'
    const body = payload.notification?.body || 'You have an update on Asanib.'
    const link = payload.fcmOptions?.link || payload.data?.link || '/'

    self.registration.showNotification(title, {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { link },
    })
  })
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = String(event.notification.data?.link || '/')
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find((client) => 'focus' in client)
    if (existing && 'navigate' in existing) {
      await existing.navigate(link)
      return existing.focus()
    }
    return self.clients.openWindow(link)
  })())
})
