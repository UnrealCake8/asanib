const DEFAULT_GATEWAY_URL = 'https://wasoft.mplace.cc'

function gatewayConfig() {
  const url = String(process.env.WHATSAPP_GATEWAY_URL || DEFAULT_GATEWAY_URL).trim().replace(/\/$/, '')
  const secret = String(process.env.WHATSAPP_GATEWAY_SECRET || '').trim()
  return { url, secret }
}

export async function sendProviderRequestAlert(provider, request, requestId) {
  const whatsapp = String(provider?.whatsapp || '').trim()
  if (!whatsapp) return { skipped: true, reason: 'provider_has_no_whatsapp' }

  const { url, secret } = gatewayConfig()
  if (!secret) return { skipped: true, reason: 'gateway_secret_not_configured' }

  const timing = request.urgency === 'now'
    ? 'Needed now'
    : request.urgency === 'today'
      ? 'Needed today'
      : request.scheduledFor || 'Scheduled'

  const appUrl = String(process.env.ASANIB_APP_URL || 'https://asanib-1.vercel.app').replace(/\/$/, '')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(`${url}/send-request-alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        to: whatsapp,
        businessName: provider.businessName || 'Provider',
        request: request.query,
        location: request.location,
        budget: request.budget,
        timing,
        url: `${appUrl}/provider?request=${encodeURIComponent(requestId)}`,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`WhatsApp gateway returned ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`)
    }

    return { ok: true }
  } finally {
    clearTimeout(timeout)
  }
}
