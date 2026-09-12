import { methodNotAllowed, requireUser, sendError } from './_firebaseAdmin.js'

function clean(value, max = 160) {
  return String(value || '').trim().slice(0, max)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  try {
    await requireUser(req)
    const input = clean(req.body?.input)
    const sessionToken = clean(req.body?.sessionToken, 80)
    if (input.length < 2) return res.status(200).json({ suggestions: [] })

    const key = String(process.env.GOOGLE_MAPS_API_KEY || '').trim()
    if (!key) return res.status(503).json({ error: 'Location search is not configured.' })

    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
      },
      body: JSON.stringify({
        input,
        includedRegionCodes: ['ae'],
        languageCode: 'en',
        regionCode: 'AE',
        ...(sessionToken ? { sessionToken } : {}),
      }),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message = payload?.error?.message || 'Could not search locations.'
      return res.status(response.status).json({ error: message })
    }

    const suggestions = (Array.isArray(payload?.suggestions) ? payload.suggestions : [])
      .map((item) => item?.placePrediction)
      .filter(Boolean)
      .slice(0, 6)
      .map((prediction) => ({
        placeId: String(prediction.placeId || ''),
        text: String(prediction.text?.text || ''),
        mainText: String(prediction.structuredFormat?.mainText?.text || prediction.text?.text || ''),
        secondaryText: String(prediction.structuredFormat?.secondaryText?.text || ''),
      }))
      .filter((item) => item.placeId && item.text)

    return res.status(200).json({ suggestions })
  } catch (error) {
    return sendError(res, error)
  }
}
