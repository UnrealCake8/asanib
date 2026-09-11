import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, methodNotAllowed, requireUser, sendError } from './_firebaseAdmin.js'
import { notifyUser } from './_notify.js'
import { sendProviderRequestAlert } from './_whatsapp.js'

function cleanText(value, max = 500) {
  return String(value || '').trim().slice(0, max)
}

function matchesProvider(provider, request) {
  if (!provider.approved) return false
  if (request.urgency === 'now' && !provider.availableNow) return false
  const categories = Array.isArray(provider.categories) ? provider.categories.map((item) => String(item).toLowerCase()) : []
  const category = request.category.toLowerCase()
  if (!categories.includes(category) && !categories.includes('local services')) return false
  const areas = Array.isArray(provider.areas) ? provider.areas.map((item) => String(item).toLowerCase().trim()).filter(Boolean) : []
  const location = request.location.toLowerCase()
  return areas.length === 0 || areas.some((area) => location.includes(area) || area.includes(location))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    const user = await requireUser(req)
    const request = {
      query: cleanText(req.body?.query, 700),
      location: cleanText(req.body?.location, 160),
      budget: req.body?.budget == null ? null : Number(req.body.budget),
      urgency: cleanText(req.body?.urgency, 20),
      scheduledFor: req.body?.scheduledFor ? cleanText(req.body.scheduledFor, 80) : null,
      category: cleanText(req.body?.category, 80),
      summary: cleanText(req.body?.summary, 240),
    }
    if (request.query.length < 8 || request.location.length < 2 || !request.category) return res.status(400).json({ error: 'Describe the job, area and service category.' })
    if (!['now', 'today', 'scheduled'].includes(request.urgency)) return res.status(400).json({ error: 'Invalid urgency.' })
    if (request.urgency === 'scheduled' && !request.scheduledFor) return res.status(400).json({ error: 'Choose a scheduled time.' })
    if (request.budget != null && (!Number.isFinite(request.budget) || request.budget <= 0 || request.budget > 1000000)) return res.status(400).json({ error: 'Invalid budget.' })

    const providersSnapshot = await adminDb.collection('providers').where('approved', '==', true).get()
    const providers = providersSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((provider) => matchesProvider(provider, request))
      .slice(0, 100)

    const requestRef = adminDb.collection('requests').doc()
    const batch = adminDb.batch()
    batch.set(requestRef, {
      ...request,
      customerId: user.uid,
      status: 'open',
      matchCount: providers.length,
      createdAt: FieldValue.serverTimestamp(),
    })
    for (const provider of providers) {
      const matchRef = adminDb.collection('providerMatches').doc(provider.id).collection('requests').doc(requestRef.id)
      batch.set(matchRef, {
        id: requestRef.id,
        requestId: requestRef.id,
        customerId: user.uid,
        ...request,
        status: 'open',
        matchedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      })
    }
    await batch.commit()

    await Promise.allSettled(providers.flatMap((provider) => [
      notifyUser(
        provider.id,
        request.urgency === 'now' ? 'Urgent job near you' : 'New matching Asanib request',
        `${request.category} in ${request.location}${request.budget ? ` · up to AED ${request.budget}` : ''}`,
        '/provider',
      ),
      sendProviderRequestAlert(provider, request, requestRef.id),
    ]))

    return res.status(201).json({ id: requestRef.id, matchCount: providers.length })
  } catch (error) {
    return sendError(res, error)
  }
}
