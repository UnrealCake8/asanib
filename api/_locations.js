const UAE_ALIASES = new Map([
  ['dubai', 'Dubai'],
  ['abu dhabi', 'Abu Dhabi'],
  ['abudhabi', 'Abu Dhabi'],
  ['sharjah', 'Sharjah'],
  ['ajman', 'Ajman'],
  ['umm al quwain', 'Umm Al Quwain'],
  ['umm al-quwain', 'Umm Al Quwain'],
  ['uaq', 'Umm Al Quwain'],
  ['ras al khaimah', 'Ras Al Khaimah'],
  ['ras al-khaimah', 'Ras Al Khaimah'],
  ['rak', 'Ras Al Khaimah'],
  ['fujairah', 'Fujairah'],
])

function clean(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

export function normalizeLocationText(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function canonicalEmirate(value) {
  const normalized = normalizeLocationText(value)
  if (UAE_ALIASES.has(normalized)) return UAE_ALIASES.get(normalized)
  for (const [alias, emirate] of UAE_ALIASES) {
    if (normalized.includes(alias)) return emirate
  }
  return null
}

function component(result, preferredTypes) {
  for (const type of preferredTypes) {
    const found = result?.address_components?.find((item) => Array.isArray(item.types) && item.types.includes(type))
    if (found?.long_name) return String(found.long_name)
  }
  return null
}

function fallbackLocation(input) {
  const label = clean(input)
  const emirate = canonicalEmirate(label)
  const parts = label.split(',').map((part) => clean(part)).filter(Boolean)
  const area = parts.length > 1 ? parts[0] : null
  return {
    label,
    placeId: null,
    latitude: null,
    longitude: null,
    area,
    city: emirate,
    emirate,
    countryCode: 'AE',
    source: 'text',
  }
}

export async function resolveUaeLocation(input) {
  const label = clean(input)
  if (!label) return fallbackLocation(label)
  const key = String(process.env.GOOGLE_MAPS_API_KEY || '').trim()
  if (!key) return fallbackLocation(label)

  try {
    const params = new URLSearchParams({
      address: label,
      components: 'country:AE',
      key,
    })
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`)
    if (!response.ok) return fallbackLocation(label)
    const payload = await response.json()
    const result = Array.isArray(payload?.results) ? payload.results[0] : null
    if (!result) return fallbackLocation(label)

    const emirate = component(result, ['administrative_area_level_1']) || canonicalEmirate(result.formatted_address)
    const city = component(result, ['locality', 'administrative_area_level_2']) || emirate
    const area = component(result, ['sublocality_level_1', 'sublocality', 'neighborhood'])
    const latitude = Number(result?.geometry?.location?.lat)
    const longitude = Number(result?.geometry?.location?.lng)

    return {
      label: String(result.formatted_address || label),
      placeId: result.place_id ? String(result.place_id) : null,
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
      area,
      city,
      emirate,
      countryCode: 'AE',
      source: 'google',
    }
  } catch {
    return fallbackLocation(label)
  }
}

function significantTokens(value) {
  const ignored = new Set(['united', 'arab', 'emirates', 'uae', 'ae', 'the', 'city', 'emirate'])
  return normalizeLocationText(value)
    .split(' ')
    .filter((token) => token.length > 1 && !ignored.has(token))
}

export function providerCoversLocation(providerAreas, requestLocation, locationData) {
  const areas = Array.isArray(providerAreas) ? providerAreas.map(clean).filter(Boolean) : []
  if (areas.length === 0) return true

  const requestText = normalizeLocationText(requestLocation)
  const requestGeo = [locationData?.area, locationData?.city, locationData?.emirate, locationData?.label]
    .filter(Boolean)
    .map(normalizeLocationText)
  const requestTokens = new Set(requestGeo.flatMap(significantTokens))

  return areas.some((providerArea) => {
    const normalizedArea = normalizeLocationText(providerArea)
    if (!normalizedArea) return false

    // Preserve the old friendly behaviour for obvious text matches.
    if (requestText.includes(normalizedArea) || normalizedArea.includes(requestText)) return true

    const providerEmirate = canonicalEmirate(providerArea)
    const requestEmirate = canonicalEmirate(locationData?.emirate || locationData?.city || requestLocation)
    if (providerEmirate && requestEmirate && providerEmirate === requestEmirate) return true

    const providerTokens = significantTokens(providerArea)
    return providerTokens.some((token) => requestTokens.has(token))
  })
}
