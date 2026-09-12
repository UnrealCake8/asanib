import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, methodNotAllowed, requireUser, sendError } from './_firebaseAdmin.js'
import { providerCoversLocation, resolveUaeLocation } from './_locations.js'
import { notifyUser } from './_notify.js'
import { classifyServiceRequest, rankProvidersForRequest } from './_requestIntelligence.js'
import { sendProviderRequestAlert } from './_whatsapp.js'

function cleanText(value, max = 500) {
  return String(value || '').trim().slice(0, max)
}

function matchesProvider(provider, request, locationData) {
  if (!provider.approved) return false
  if (request.urgency === 'now' && !provider.availableNow) return false
  const categories = Array.isArray(provider.categories) ? provider.categories.map((item) => String(item).toLowerCase()) : []
  const category = request.category.toLowerCase()
  if (!categories.includes(category) && !categories.includes('local services')) return false
  return providerCoversLocation(provider.areas, request.location, locationData)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    const user = await requireUser(req)
    const baseRequest = {
      query: cleanText(req.body?.query, 700),
      location: cleanText(req.body?.location, 160),
      budget: req.body?.budget == null ? null : Number(req.body.budget),
      urgency: cleanText(req.body?.urgency, 20),
      scheduledFor: req.body?.scheduledFor ? cleanText(req.body.scheduledFor, 80) : null,
    }
    if (baseRequest.query.length < 8 || baseRequest.location.length < 2) return res.status(400).json({ error: 'Describe the job and area.' })
    if (!['now', 'today', 'scheduled'].includes(baseRequest.urgency)) return res.status(400).json({ error: 'Invalid urgency.' })
    if (baseRequest.urgency === 'scheduled' && !baseRequest.scheduledFor) return res.status(400).json({ error: 'Choose a scheduled time.' })
    if (baseRequest.budget != null && (!Number.isFinite(baseRequest.budget) || baseRequest.budget <= 0 || baseRequest.budget > 1000000)) return res.status(400).json({ error: 'Invalid budget.' })

    const classification = await classifyServiceRequest(baseRequest)
    const request = {
      ...baseRequest,
      category: classification.category,
      summary: classification.summary,
      serviceTags: classification.serviceTags,
      routingSource: classification.source,
      routingConfidence: classification.confidence,
    }

    const locationData = await resolveUaeLocation(request.location)
    const providersSnapshot = await adminDb.collection('providers').where('approved', '==', true).get()
    const eligibleProviders = providersSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((provider) => matchesProvider(provider, request, locationData))
      .slice(0, 100)
    const providers = await rankProvidersForRequest(request, eligibleProviders)

    const requestRef = adminDb.collection('requests').doc()
    const batch = adminDb.batch()
    batch.set(requestRef, {
      ...request,
      locationData,
      customerId: user.uid,
      status: 'open',
      matchCount: providers.length,
      createdAt: FieldValue.serverTimestamp(),
    })
    providers.forEach((provider, index) => {
      const matchRef = adminDb.collection('providerMatches').doc(provider.id).collection('requests').doc(requestRef.id)
      batch.set(matchRef, {
        id: requestRef.id,
        requestId: requestRef.id,
        customerId: user.uid,
        ...request,
        locationData,
        status: 'open',
        routingRank: index + 1,
        matchedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      })
    })
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

    return res.status(201).json({
      id: requestRef.id,
      matchCount: providers.length,
      location: locationData,
      category: request.category,
      routingSource: request.routingSource,
    })
  } catch (error) {
    return sendError(res, error)
  }
}
