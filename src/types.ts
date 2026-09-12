export type Urgency = 'now' | 'today' | 'scheduled'
export type RequestStatus = 'open' | 'booked' | 'cancelled' | 'completed'
export type QuoteStatus = 'pending' | 'accepted' | 'withdrawn'
export type BookingStatus = 'booked' | 'in_progress' | 'completed' | 'cancelled'
export type KybStatus = 'not_started' | 'pending' | 'verified' | 'rejected'
export type PaymentLinkStatus = 'none' | 'pending_review' | 'approved' | 'rejected'
export type KybDocumentType = 'trade_license' | 'emirates_id_front' | 'emirates_id_back'

export interface LocationData {
  label: string
  placeId?: string | null
  latitude?: number | null
  longitude?: number | null
  area?: string | null
  city?: string | null
  emirate?: string | null
  countryCode?: string | null
  source?: 'google' | 'text' | string
}

export interface ServiceRequestDraft {
  query: string
  location: string
  budget?: number
  urgency: Urgency
  scheduledFor?: string
}

export interface ParsedRequest extends ServiceRequestDraft {
  category: string
  summary: string
}

export interface ServiceRequest extends ParsedRequest {
  id: string
  customerId: string
  status: RequestStatus
  acceptedQuoteId?: string
  acceptedProviderId?: string
  closedReason?: string
  locationData?: LocationData
  createdAt?: unknown
  updatedAt?: unknown
}

export interface ProviderProfile {
  id: string
  ownerUid: string
  businessName: string
  phone: string
  whatsapp?: string
  categories: string[]
  areas: string[]
  availableNow: boolean
  approved: boolean
  legalBusinessName?: string | null
  tradeLicenseNumber?: string | null
  licensingAuthority?: string | null
  licenseExpiry?: string | null
  representativeName?: string | null
  representativeConfirmed?: boolean
  tradeLicensePath?: string | null
  emiratesIdFrontPath?: string | null
  emiratesIdBackPath?: string | null
  kybStatus?: KybStatus
  kybReviewNote?: string | null
  checkoutUrl?: string | null
  checkoutProvider?: string | null
  checkoutHost?: string | null
  paymentLinkStatus?: PaymentLinkStatus
  paymentLinkReviewNote?: string | null
  ziinaConnected?: boolean
  ziinaAccountStatus?: string | null
  ziinaDisplayName?: string | null
  ziinaZiiname?: string | null
  createdAt?: unknown
  updatedAt?: unknown
}

export interface Quote {
  id: string
  requestId: string
  providerId: string
  providerName: string
  providerPhone?: string
  providerWhatsapp?: string
  amount: number
  etaMinutes?: number
  message?: string
  status: QuoteStatus
  withdrawnReason?: string
  checkoutUrl?: string | null
  checkoutProvider?: string | null
  checkoutHost?: string | null
  createdAt?: unknown
}

export interface Booking {
  id: string
  requestId: string
  customerId: string
  providerId: string
  providerName: string
  providerPhone?: string
  providerWhatsapp?: string
  quoteId: string
  amount: number
  status: BookingStatus
  checkoutUrl?: string | null
  checkoutProvider?: string | null
  checkoutHost?: string | null
  paymentProcessor?: string | null
  paymentStatus?: string | null
  paymentAmountFils?: number | null
  ziinaPaymentIntentId?: string | null
  paidAt?: unknown
  createdAt?: unknown
}

export interface Review {
  id: string
  bookingId: string
  requestId: string
  customerId: string
  providerId: string
  providerName: string
  rating: number
  comment?: string
  createdAt?: unknown
  updatedAt?: unknown
}
