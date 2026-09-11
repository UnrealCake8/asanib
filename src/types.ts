export type Urgency = 'now' | 'today' | 'scheduled'
export type RequestStatus = 'open' | 'booked' | 'cancelled' | 'completed'
export type QuoteStatus = 'pending' | 'accepted' | 'withdrawn'
export type BookingStatus = 'booked' | 'in_progress' | 'completed' | 'cancelled'

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
  createdAt?: unknown
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
