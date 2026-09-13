const DEFAULT_GATEWAY_URL = 'https://wasoft.mplace.cc'

function config() {
  return {
    url: String(process.env.WHATSAPP_GATEWAY_URL || DEFAULT_GATEWAY_URL).trim().replace(/\/$/, ''),
    secret: String(process.env.WHATSAPP_GATEWAY_SECRET || '').trim(),
  }
}

function timingLabel(request) {
  if (request.urgency === 'now') return 'Needed now'
  if (request.urgency === 'today') return 'Needed today'
  return request.scheduledFor || 'Scheduled'
}

async function post(path, body) {
  const { url, secret } = config()
  if (!secret) throw Object.assign(new Error('WHATSAPP_GATEWAY_SECRET is not configured.'), { statusCode: 503 })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(`${url}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw Object.assign(new Error(payload.error || `WhatsApp gateway returned ${response.status}.`), { statusCode: 502 })
    return payload
  } finally {
    clearTimeout(timeout)
  }
}

export async function sendExternalLead(provider, request) {
  return post('/send-external-lead', {
    to: provider.whatsapp,
    businessName: provider.businessName || '',
    request: request.query,
    location: request.location,
    budget: request.budget ?? null,
    timing: timingLabel(request),
    includeSignup: true,
  })
}

export async function sendCustomerDetails(provider, request) {
  const phone = String(request.contactPhone || '').replace(/\D/g, '')
  if (!phone || !request.shareContactConsent) throw Object.assign(new Error('Customer contact sharing is not authorized.'), { statusCode: 409 })
  const lines = [
    'Thanks, here are the customer details for this Asanib lead:',
    '',
    request.query,
    `Location: ${request.location}`,
    request.budget ? `Budget: up to AED ${request.budget}` : null,
    `Timing: ${timingLabel(request)}`,
    '',
    `Customer WhatsApp/phone: +${phone}`,
    '',
    'Please contact the customer directly. Asanib does not take commission, and you keep 100% of the service payment.',
  ].filter(Boolean).join('\n')
  return post('/send', { to: provider.whatsapp, message: lines })
}
