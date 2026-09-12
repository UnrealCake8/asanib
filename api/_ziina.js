import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from './_firebaseAdmin.js'

const API = 'https://api-v2.ziina.com/api'
const AUTH = 'https://auth.ziina.com'
export const ZIINA_SCOPES = ['read_account', 'write_payment_intents', 'write_webhooks', 'offline_access']

function basicAuth() {
  const username = process.env.ZIINA_OAUTH_USERNAME
  const password = process.env.ZIINA_OAUTH_PASSWORD
  if (!username || !password) throw Object.assign(new Error('Ziina OAuth credentials are not configured.'), { statusCode: 503 })
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
}

export function ziinaConfigured() {
  return Boolean(process.env.ZIINA_CLIENT_ID && process.env.ZIINA_OAUTH_USERNAME && process.env.ZIINA_OAUTH_PASSWORD && process.env.ZIINA_REDIRECT_URI)
}

export function getRedirectUri() {
  const value = String(process.env.ZIINA_REDIRECT_URI || '').trim()
  if (!value) throw Object.assign(new Error('ZIINA_REDIRECT_URI is not configured.'), { statusCode: 503 })
  return value
}

export function buildAuthorizeUrl(state) {
  const clientId = process.env.ZIINA_CLIENT_ID
  if (!clientId) throw Object.assign(new Error('ZIINA_CLIENT_ID is not configured.'), { statusCode: 503 })
  const url = new URL(`${AUTH}/oidc/auth`)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', getRedirectUri())
  url.searchParams.set('scope', ZIINA_SCOPES.join(' '))
  url.searchParams.set('state', state)
  url.searchParams.set('prompt', 'consent')
  return url.toString()
}

async function tokenRequest(params) {
  const response = await fetch(`${AUTH}/oidc/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: basicAuth() },
    body: new URLSearchParams(params).toString(),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload?.access_token) {
    throw Object.assign(new Error(payload?.error_description || payload?.error || 'Could not connect Ziina.'), { statusCode: 502 })
  }
  return payload
}

export async function exchangeCode(code) {
  return tokenRequest({
    code,
    redirect_uri: getRedirectUri(),
    grant_type: 'authorization_code',
    scope: ZIINA_SCOPES.join(' '),
  })
}

async function refreshAccessToken(refreshToken) {
  return tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' })
}

export async function ziinaApi(path, token, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(payload?.error?.message || payload?.error || payload?.message || 'Ziina request failed.'), { statusCode: 502 })
  return payload
}

export async function getZiinaAccount(token) {
  return ziinaApi('/account', token, { method: 'GET' })
}

export async function saveConnection(providerId, tokens, account) {
  const expiresIn = Number(tokens.expires_in || 0)
  await adminDb.collection('providerZiinaConnections').doc(providerId).set({
    providerId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || null,
    expiresAtMs: expiresIn > 0 && Number.isFinite(expiresIn) ? Date.now() + Math.min(expiresIn * 1000, 365 * 24 * 60 * 60 * 1000) : null,
    scope: String(tokens.scope || ''),
    accountId: String(account.account_id || ''),
    accountType: String(account.account_type || ''),
    accountStatus: String(account.status || ''),
    ziiname: String(account.ziiname || ''),
    displayName: String(account.display_name || ''),
    connectedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
  await adminDb.collection('providers').doc(providerId).set({
    ziinaConnected: account.status === 'active',
    ziinaAccountStatus: String(account.status || ''),
    ziinaDisplayName: String(account.display_name || ''),
    ziinaZiiname: String(account.ziiname || ''),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
}

export async function getProviderZiinaToken(providerId) {
  const ref = adminDb.collection('providerZiinaConnections').doc(providerId)
  const snap = await ref.get()
  if (!snap.exists) throw Object.assign(new Error('This provider has not connected Ziina Checkout.'), { statusCode: 409 })
  const data = snap.data()
  if (data.accountStatus !== 'active') throw Object.assign(new Error('This provider’s Ziina account is not active.'), { statusCode: 409 })

  const shouldRefresh = data.refreshToken && data.expiresAtMs && Number(data.expiresAtMs) < Date.now() + 60_000
  if (!shouldRefresh) return String(data.accessToken || '')

  const tokens = await refreshAccessToken(String(data.refreshToken))
  const expiresIn = Number(tokens.expires_in || 0)
  await ref.set({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || data.refreshToken,
    expiresAtMs: expiresIn > 0 && Number.isFinite(expiresIn) ? Date.now() + Math.min(expiresIn * 1000, 365 * 24 * 60 * 60 * 1000) : data.expiresAtMs || null,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
  return String(tokens.access_token)
}

export async function registerProviderWebhook(token) {
  const secret = process.env.ZIINA_WEBHOOK_SECRET
  const url = process.env.ZIINA_WEBHOOK_URL
  if (!secret || !url) return false
  await ziinaApi('/webhook', token, { method: 'POST', body: JSON.stringify({ url, secret }) })
  return true
}
