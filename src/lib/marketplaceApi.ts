import { auth } from './firebase'
import type { KybDocumentType, ProviderProfile, Quote, ServiceRequest } from '../types'

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
  emiratesIdFrontPath?: string | null
  emiratesIdBackPath?: string | null
  checkoutUrl?: string
  checkoutProvider?: string
}) {
  return authenticatedPost<{ ok: true; kybStatus: string; approved: boolean; paymentLinkStatus: string }>('/api/update-provider-profile', input)
}

export async function uploadKybDocument(file: File, documentType: KybDocumentType): Promise<string> {
  const user = auth?.currentUser
  if (!user) throw new Error('Provider sign-in required.')
  const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
  if (!allowedTypes.has(file.type)) throw new Error('Upload a PDF, JPG, PNG or WebP verification document.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Verification documents must be smaller than 10 MB.')

  const { uploadUrl, key } = await authenticatedPost<{ uploadUrl: string; key: string }>('/api/kyb-upload-url', {
    contentType: file.type,
    size: file.size,
    documentType,
  })

  const upload = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!upload.ok) throw new Error('Verification document upload failed. Please try again.')
  return key
}

export async function uploadTradeLicense(file: File): Promise<string> {
  return uploadKybDocument(file, 'trade_license')
}

export interface ProviderPayoutItem {
  id: string
  amountFils: number
  method: 'bank' | 'payment_link'
  status: 'pending' | 'processing' | 'paid' | 'rejected' | string
  destinationLabel?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface ProviderPayoutSummary {
  totalEarnedFils: number
  availableFils: number
  pendingFils: number
  paidOutFils: number
  eligibleBookingCount: number
  payoutMethod?: 'bank' | 'payment_link' | null
  bankAccountHolder?: string | null
  bankName?: string | null
  bankIban?: string | null
  bankProofPath?: string | null
  payoutPaymentLink?: string | null
  payouts: ProviderPayoutItem[]
}

export async function getProviderPayoutSummary() {
  return authenticatedPost<ProviderPayoutSummary>('/api/provider-payout-summary', {})
}

export async function uploadBankAccountProof(file: File): Promise<string> {
  const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
  if (!allowedTypes.has(file.type)) throw new Error('Upload a PDF, JPG, PNG or WebP bank document.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Bank proof must be smaller than 10 MB.')
  const { uploadUrl, key } = await authenticatedPost<{ uploadUrl: string; key: string }>('/api/payout-upload-url', {
    contentType: file.type,
    size: file.size,
  })
  const upload = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
  if (!upload.ok) throw new Error('Bank proof upload failed. Please try again.')
  return key
}

export async function requestProviderPayout(input: {
  method: 'bank' | 'payment_link'
  bankAccountHolder?: string
  bankName?: string
  bankIban?: string
  bankProofPath?: string | null
  payoutPaymentLink?: string
}) {
  return authenticatedPost<{ id: string; amountFils: number; status: string; method: string; destinationLabel: string }>('/api/request-payout', input)
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
      checkoutHost: 'pay.ziina.com',
    }
  }
  return result
}

export async function startAsanibCheckout(bookingId: string) {
  return authenticatedPost<{
    paymentIntentId: string
    redirectUrl: string
    status: string
    amountFils: number
    providerName: string
    merchantName: string
  }>('/api/ziina-checkout', { bookingId })
}

export async function getAsanibCheckoutStatus(bookingId: string) {
  return authenticatedPost<{ status: string; paymentIntentId?: string }>('/api/ziina-payment-status', { bookingId })
}

export async function reviewProvider(providerId: string, action: 'verify_kyb' | 'reject_kyb' | 'approve_payment_link' | 'reject_payment_link' | 'revoke_provider', note = '') {
  return authenticatedPost<{ ok: true }>('/api/admin-provider-review', { providerId, action, note })
}

export async function openKybDocument(providerId: string, documentType: KybDocumentType) {
  const payload = await authenticatedPost<{ url: string }>('/api/admin-kyb-document', { providerId, documentType })
  window.open(payload.url, '_blank', 'noopener,noreferrer')
}

export async function openTradeLicense(providerId: string) {
  return openKybDocument(providerId, 'trade_license')
}

export async function saveExternalProvider(input: {
  providerId?: string
  businessName: string
  whatsapp: string
  phone?: string
  categories: string[]
  areas: string[]
  sourceUrl?: string
  notes?: string
}) {
  return authenticatedPost<{ ok: true; providerId: string }>('/api/admin-external-provider', input)
}

export async function prepareExternalLead(requestId: string, providerId: string) {
  return authenticatedPost<{ ok: true; dispatchId: string; message: string; whatsappUrl: string }>('/api/admin-external-dispatch', { requestId, providerId })
}
