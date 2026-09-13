import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, methodNotAllowed, requireAdmin, sendError } from './_firebaseAdmin.js'

function clean(value, max = 200) {
  return String(value || '').trim().slice(0, max)
}

function normalizeNumber(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) throw Object.assign(new Error('Enter a valid international number.'), { statusCode: 400 })
  return digits
}

function list(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(',')
  return [...new Set(items.map((item) => clean(item, 100)).filter(Boolean))].slice(0, 20)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    const admin = await requireAdmin(req)
    const businessName = clean(req.body?.businessName, 120)
    const whatsapp = normalizeNumber(req.body?.whatsapp)
    const categories = list(req.body?.categories)
    const areas = list(req.body?.areas)
    if (!businessName || !categories.length || !areas.length) return res.status(400).json({ error: 'Business name, category and service area are required.' })

    const providerId = clean(req.body?.providerId, 120)
    const ref = providerId ? adminDb.collection('externalProviders').doc(providerId) : adminDb.collection('externalProviders').doc()
    const existing = await ref.get()
    await ref.set({
      businessName,
      whatsapp,
      phone: clean(req.body?.phone || whatsapp, 40),
      categories,
      areas,
      sourceUrl: clean(req.body?.sourceUrl, 500) || null,
      notes: clean(req.body?.notes, 1000) || null,
      archived: false,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
      ...(existing.exists ? {} : { leadOptIn: null, createdAt: FieldValue.serverTimestamp(), createdBy: admin.uid }),
    }, { merge: true })
    return res.json({ ok: true, providerId: ref.id })
  } catch (error) {
    return sendError(res, error)
  }
}
