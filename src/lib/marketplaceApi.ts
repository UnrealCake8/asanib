import { auth } from './firebase'
import type { ProviderProfile, Quote, ServiceRequest } from '../types'

async function authenticatedPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const user = auth?.currentUser
  if (!user) throw new Error('Sign in is required.')
  const token = await user.getIdToken()
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || 'Asanib could not complete that action.')
  return payload
}

export async function saveProviderBusiness(input: {
  businessName: string
  phone: string
  whatsapp?: string
  categories: string[]
  areas: string[]
  legalBusinessName?: string
  tradeLicenseNumber?: string
  licensingAuthority?: string
  licenseExpiry?: string
  representativeName?: string
  representativeConfirmed?: boolean
  tradeLicensePath?: string | null
  checkoutUrl?: string
  checkoutProvider?: string
}) {
  return authenticatedPost<{ ok: true; kybStatus: string; approved: boolean; paymentLinkStatus: string }>('/api/update-provider-profile', input)
}

export async function uploadTradeLicense(file: File): Promise<string> {
  const user = auth?.currentUser
  if (!user) throw new Error('Provider sign-in required.')
  const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
  if (!allowedTypes.has(file.type)) throw new Error('Upload a PDF, JPG, PNG or WebP trade licence.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Trade licence files must be smaller than 10 MB.')

  const { uploadUrl, key } = await authenticatedPost<{ uploadUrl: string; key: string }>('/api/kyb-upload-url', {
    contentType: file.type,
    size: file.size,
  })

  const upload = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!upload.ok) throw new Error('Trade licence upload failed. Please try again.')
  return key
}

export async function acceptQuoteWithCheckout(request: ServiceRequest, quote: Quote) {
  if (quote.requestId !== request.id) throw new Error('Quote does not belong to this request.')
  const result = await authenticatedPost<{
    bookingId: string
    providerId: string
    providerName: string
    checkoutUrl?: string | null
    checkoutProvider?: string | null
    checkoutHost?: string | null
    asanibCheckoutAvailable?: boolean
  }>('/api/accept-quote', { requestId: request.id, quoteId: quote.id })

  if (result.asanibCheckoutAvailable) {
    return {
      ...result,
      checkoutUrl: `/checkout/${result.bookingId}`,
      checkoutProvider: 'Asanib Checkout · Ziina',
      checkoutHost: 'asanib',
    }
  }
  return result
}

export async function startZiinaConnect() {
  return authenticatedPost<{ authorizationUrl: string }>('/api/ziina-connect-start', {})
}

export async function startAsanibCheckout(bookingId: string) {
  return authenticatedPost<{
    paymentIntentId: string
    embeddedUrl: string
    status: string
    amountFils: number
    providerName: string
  }>('/api/ziina-checkout', { bookingId })
}

export async function getAsanibCheckoutStatus(bookingId: string) {
  return authenticatedPost<{ status: string; paymentIntentId?: string }>('/api/ziina-payment-status', { bookingId })
}

export async function reviewProvider(providerId: string, action: 'verify_kyb' | 'reject_kyb' | 'approve_payment_link' | 'reject_payment_link' | 'revoke_provider', note = '') {
  return authenticatedPost<{ ok: true }>('/api/admin-provider-review', { providerId, action, note })
}

export async function openTradeLicense(providerId: string) {
  const payload = await authenticatedPost<{ url: string }>('/api/admin-kyb-document', { providerId })
  window.open(payload.url, '_blank', 'noopener,noreferrer')
}
