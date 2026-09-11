import { adminDb, adminMessaging } from './_firebaseAdmin.js'

export async function notifyUser(uid, title, body, link = '/') {
  const registrations = await adminDb.collection('users').doc(uid).collection('pushRegistrations').get()
  const fids = registrations.docs.map((doc) => doc.id).filter(Boolean).slice(0, 500)
  if (!fids.length) return { sent: 0 }

  const result = await adminMessaging.sendEachForMulticast({
    fids,
    notification: { title, body },
    data: { link },
    webpush: { fcmOptions: { link } },
  })

  const removals = []
  result.responses.forEach((response, index) => {
    if (!response.success) {
      const code = response.error?.code || ''
      if (code.includes('registration-token-not-registered') || code.includes('requested-entity-not-found')) {
        removals.push(adminDb.collection('users').doc(uid).collection('pushRegistrations').doc(fids[index]).delete())
      }
    }
  })
  if (removals.length) await Promise.allSettled(removals)
  return { sent: result.successCount }
}
