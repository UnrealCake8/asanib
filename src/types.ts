export type Urgency = 'now' | 'today' | 'scheduled'

export interface ServiceRequestDraft {
  query: string
  location: string
  budget?: number
  urgency: Urgency
}

export interface ParsedRequest extends ServiceRequestDraft {
  category: string
  summary: string
}
