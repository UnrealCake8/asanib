import { getStorage, ref, uploadBytes } from 'firebase/storage'
import { auth, firebaseApp } from './firebase'
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
  if (!user || !firebaseApp) throw new Error('Provider sign-in required.')
  const allowed = file.type === 'application/pdf' || file.type.startsWith('image/')
  if (!allowed) throw new Error('Upload a PDF or image of the trade licence.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Trade licence files must be smaller than 10 MB.')

  const extension = file.name.includes('.') ? file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) : ''
  const filename = `trade-licence-${Date.now()}${extension ? `.${extension}` : ''}`
  const path = `kyb/${user.uid}/${filename}`
  const storage = getStorage(firebaseApp)
  await uploadBytes(ref(storage, path), file, { contentType: file.type || 'application/octet-stream' })
  return path
}

export async function acceptQuoteWithCheckout(request: ServiceRequest, quote: Quote) {
  if (quote.requestId !== request.id) throw new Error('Quote does not belong to this request.')
  return authenticatedPost<{
    bookingId: string
    providerId: string
    providerName: string
    checkoutUrl?: string | null
    checkoutProvider?: string | null
    checkoutHost?: string | null
  }>('/api/accept-quote', { requestId: request.id, quoteId: quote.id })
}

export async function reviewProvider(providerId: string, action: 'verify_kyb' | 'reject_kyb' | 'approve_payment_link' | 'reject_payment_link' | 'revoke_provider', note = '') {
  return authenticatedPost<{ ok: true }>('/api/admin-provider-review', { providerId, action, note })
}

export async function openTradeLicense(providerId: string) {
  const payload = await authenticatedPost<{ url: string }>('/api/admin-kyb-document', { providerId })
  window.open(payload.url, '_blank', 'noopener,noreferrer')
}
