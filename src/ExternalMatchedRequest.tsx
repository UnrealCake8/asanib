import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import CustomerAppV2 from './CustomerAppV2'
import { firebaseConfigured } from './lib/firebase'
import { watchAuth, watchRequest } from './lib/data'
import type { ServiceRequest } from './types'

export default function ExternalMatchedRequest({ requestId }: { requestId: string }) {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(!firebaseConfigured)
  const [request, setRequest] = useState<ServiceRequest | null>(null)

  useEffect(() => watchAuth((next) => {
    setUser(next)
    setAuthReady(true)
  }), [])

  useEffect(() => {
    if (!firebaseConfigured || !user) return
    return watchRequest(requestId, setRequest)
  }, [requestId, user])

  if (!firebaseConfigured || !authReady || !user || !request) return <CustomerAppV2 />
  if (request.externalMatchStatus !== 'provider_interested') return <CustomerAppV2 />

  const businessName = request.matchedExternalProviderName?.trim() || 'A local business'

  return <main className="customer-v2-shell">
    <header className="customer-v2-header">
      <a className="back-link" href="/">← Home</a>
      <a className="brand" href="/">asanib<span>.</span></a>
      <span />
    </header>
    <div className="customer-v2-content tab-page">
      <div className="request-detail-v2">
        <div className="request-title-row">
          <div>
            <span className="eyebrow">{request.urgency === 'now' ? 'NEED IT NOW' : 'SERVICE REQUEST'}</span>
            <h1>{request.query}</h1>
          </div>
          <span className="status large open">MATCHED</span>
        </div>
        <div className="request-facts">
          <div><span>Where</span><strong>{request.location}</strong></div>
          <div><span>Budget</span><strong>{request.budget ? `Up to AED ${request.budget}` : 'Open'}</strong></div>
          <div><span>Service</span><strong>{request.category}</strong></div>
        </div>
      </div>

      <div className="success-panel">
        <span className="eyebrow">BUSINESS FOUND</span>
        <strong>{businessName} can help.</strong>
        <p>We've shared your contact details with them. They should contact you directly shortly.</p>
      </div>

      <section className="quote-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">WHAT HAPPENS NOW?</span>
            <h2>The business will contact you.</h2>
          </div>
        </div>
        <div className="empty-state large">
          <strong>Arrange the details directly.</strong>
          <p>They'll contact you to confirm the job, timing and final price. You pay the business directly. Asanib does not take a commission from the service payment.</p>
        </div>
        <a className="text-button" href="/">Return home</a>
      </section>
    </div>
  </main>
}
