import { methodNotAllowed, requireUser, sendError } from './_firebaseAdmin.js'

function clean(value, max = 220) {
  return String(value || '').trim().slice(0, max)
}

function component(components, preferredTypes) {
  for (const type of preferredTypes) {
    const found = components.find((item) => Array.isArray(item.types) && item.types.includes(type))
    if (found?.longText) return String(found.longText)
  }
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    await requireUser(req)
    const placeId = clean(req.body?.placeId)
    const sessionToken = clean(req.body?.sessionToken, 80)
    if (!placeId) return res.status(400).json({ error: 'Place ID is required.' })

    const key = String(process.env.GOOGLE_MAPS_API_KEY || '').trim()
    if (!key) return res.status(503).json({ error: 'Location search is not configured.' })

    const params = new URLSearchParams({ languageCode: 'en', regionCode: 'AE' })
    if (sessionToken) params.set('sessionToken', sessionToken)
    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?${params.toString()}`, {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'id,formattedAddress,location,addressComponents',
      },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message = payload?.error?.message || 'Could not load this location.'
      return res.status(response.status).json({ error: message })
    }

    const components = Array.isArray(payload.addressComponents) ? payload.addressComponents : []
    return res.status(200).json({
      location: {
        label: String(payload.formattedAddress || ''),
        placeId: String(payload.id || placeId),
        latitude: Number.isFinite(Number(payload.location?.latitude)) ? Number(payload.location.latitude) : null,
        longitude: Number.isFinite(Number(payload.location?.longitude)) ? Number(payload.location.longitude) : null,
        area: component(components, ['sublocality_level_1', 'sublocality', 'neighborhood']),
        city: component(components, ['locality', 'administrative_area_level_2']),
        emirate: component(components, ['administrative_area_level_1']),
        countryCode: 'AE',
        source: 'google',
      },
    })
  } catch (error) {
    return sendError(res, error)
  }
}
