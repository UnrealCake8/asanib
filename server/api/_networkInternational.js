const SANDBOX_BASE_URL = 'https://api-gateway.sandbox.ngenius-payments.com'
const LIVE_BASE_URL = 'https://api-gateway.ngenius-payments.com'
const MEDIA_TYPE = 'application/vnd.ni-payment.v2+json'
const IDENTITY_MEDIA_TYPE = 'application/vnd.ni-identity.v1+json'

export function networkInternationalConfig(env = process.env) {
  const environment = String(env.NETWORK_INTERNATIONAL_ENVIRONMENT || 'sandbox').trim()
  if (environment !== 'sandbox' && environment !== 'live') throw Object.assign(new Error('Network International environment must be sandbox or live.'), { statusCode: 503 })
  const apiKey = String(env.NETWORK_INTERNATIONAL_API_KEY || '').trim()
  const outletRef = String(env.NETWORK_INTERNATIONAL_OUTLET_REF || '').trim()
  if (!apiKey || !outletRef) {
    throw Object.assign(new Error('Network International sandbox credentials are not configured.'), { statusCode: 503 })
  }
  return { apiKey, outletRef, environment, baseUrl: environment === 'live' ? LIVE_BASE_URL : SANDBOX_BASE_URL }
}

export function toMinorUnits(amount) {
  const value = Number(amount)
  if (!Number.isFinite(value) || value <= 0) throw Object.assign(new Error('Payment amount is invalid.'), { statusCode: 400 })
  return Math.round(value * 100)
}

export function orderReference(order) {
  return String(order?.reference || order?._id || '').replace(/^urn:order:/, '').trim()
}

export function paymentState(order) {
  const payments = Array.isArray(order?._embedded?.payment) ? order._embedded.payment : []
  return String(payments[0]?.state || order?.state || '').toUpperCase()
}

export function paymentStatus(order, eventName = '') {
  const state = paymentState(order)
  const action = String(order?.action || '').toUpperCase()
  const event = String(eventName || '').toUpperCase()
  if (event && event !== state) return 'pending'
  if ((action === 'PURCHASE' && state === 'PURCHASED') || (action === 'SALE' && state === 'CAPTURED')) return 'paid'
  if (action === 'AUTH' && state === 'AUTHORISED') return 'authorised'
  if (state === 'PURCHASED' || state === 'CAPTURED') return 'paid'
  if (state === 'FAILED' || state === 'DECLINED' || state === 'CANCELLED' || state === 'REVERSED') return 'failed'
  return 'pending'
}

export function validPaymentUrl(value, environment) {
  const expectedHost = environment === 'live' ? 'paypage.ngenius-payments.com' : 'paypage.sandbox.ngenius-payments.com'
  try { return new URL(String(value)).protocol === 'https:' && new URL(String(value)).hostname === expectedHost } catch { return false }
}

async function requestJson(url, init) {
  const response = await fetch(url, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload?.errors?.[0]?.message || payload?.error_description || payload?.message || 'Network International request failed.'
    throw Object.assign(new Error(message), { statusCode: 502 })
  }
  return payload
}

export async function getNetworkAccessToken(env = process.env) {
  const { apiKey, baseUrl } = networkInternationalConfig(env)
  const payload = await requestJson(`${baseUrl}/identity/auth/access-token`, {
    method: 'POST',
    headers: {
      accept: IDENTITY_MEDIA_TYPE,
      authorization: `Basic ${apiKey}`,
      'content-type': IDENTITY_MEDIA_TYPE,
    },
    body: JSON.stringify({ realmName: 'ni' }),
  })
  if (!payload?.access_token) throw Object.assign(new Error('Network International did not return an access token.'), { statusCode: 502 })
  return String(payload.access_token)
}

export async function createNetworkOrder({ amount, emailAddress, redirectUrl, merchantOrderReference }, env = process.env) {
  const { outletRef, environment, baseUrl } = networkInternationalConfig(env)
  const token = await getNetworkAccessToken(env)
  const order = await requestJson(`${baseUrl}/transactions/outlets/${encodeURIComponent(outletRef)}/orders`, {
    method: 'POST',
    headers: {
      accept: MEDIA_TYPE,
      authorization: `Bearer ${token}`,
      'content-type': MEDIA_TYPE,
    },
    body: JSON.stringify({
      action: 'PURCHASE',
      amount: { currencyCode: 'AED', value: toMinorUnits(amount) },
      emailAddress,
      merchantAttributes: { redirectUrl },
      merchantOrderReference,
    }),
  })
  const paymentUrl = String(order?._links?.payment?.href || '')
  if (!validPaymentUrl(paymentUrl, environment)) throw Object.assign(new Error('Network International did not return a valid payment page.'), { statusCode: 502 })
  const reference = orderReference(order)
  if (!reference) throw Object.assign(new Error('Network International did not return an order reference.'), { statusCode: 502 })
  return { order, paymentUrl, reference }
}

export async function retrieveNetworkOrder(reference, env = process.env) {
  const { outletRef, baseUrl } = networkInternationalConfig(env)
  const token = await getNetworkAccessToken(env)
  return requestJson(`${baseUrl}/transactions/outlets/${encodeURIComponent(outletRef)}/orders/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: { accept: MEDIA_TYPE, authorization: `Bearer ${token}` },
  })
}
