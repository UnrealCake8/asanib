const API = 'https://api-v2.ziina.com/api'

export function getZiinaToken() {
  const token = String(process.env.ZIINA_API_TOKEN || '').trim()
  if (!token) throw Object.assign(new Error('Ziina Checkout is not configured.'), { statusCode: 503 })
  return token
}

export function ziinaConfigured() {
  return Boolean(String(process.env.ZIINA_API_TOKEN || '').trim())
}

export async function ziinaApi(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${getZiinaToken()}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw Object.assign(new Error(payload?.error?.message || payload?.error || payload?.message || 'Ziina request failed.'), { statusCode: 502 })
  }
  return payload
}
