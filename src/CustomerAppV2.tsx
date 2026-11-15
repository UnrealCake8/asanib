import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import LocationInput from './LocationInput'
import JsvWordmark, { JsvMark } from './JsvWordmark'
import { firebaseConfigured } from './lib/firebase'
import {
  cancelRequest,
  createServiceRequest,
  customerCreateAccount,
  customerSignIn,
  logOut,
  submitReview,
  watchAuth,
  watchCustomerBookings,
  watchCustomerReviews,
  watchMyRequests,
  watchQuotesForRequest,
  watchRequest,
} from './lib/data'
import { acceptQuoteWithCheckout, startNetworkCheckout } from './lib/marketplaceApi'
import type { Booking, ParsedRequest, Quote, Review, ServiceRequest, ServiceRequestDraft, Urgency } from './types'

function parseDraft(draft: ServiceRequestDraft): ParsedRequest {
  const q = draft.query.toLowerCase()
  const category = q.includes('ac') || q.includes('clean') || q.includes('plumb') || q.includes('electric') || q.includes('handyman')
    ? 'Home services'
    : q.includes('package') || q.includes('deliver') || q.includes('courier') || q.includes('move')
      ? 'Send & errands'
      : q.includes('car') || q.includes('tyre') || q.includes('tire') || q.includes('battery') || q.includes('wash')
        ? 'Auto services'
        : q.includes('salon') || q.includes('beauty') || q.includes('hair') || q.includes('nail')
          ? 'Beauty'
          : 'Local services'
  return { ...draft, category, summary: `${category}${draft.location ? ` near ${draft.location}` : ''}` }
}

function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(!firebaseConfigured)
  useEffect(() => watchAuth((next) => { setUser(next); setReady(true) }), [])
  return { user, ready }
}

function MarketRouteGraphic() {
  return <svg className="market-route-diagram" viewBox="0 0 720 520" role="img" aria-labelledby="market-route-title market-route-desc">
    <title id="market-route-title">How a JSV Market request moves</title>
    <desc id="market-route-desc">One customer request is matched to relevant businesses, which reply with timing and quotes.</desc>
    <defs><marker id="route-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0l10 5-10 5z" /></marker></defs>
    <path className="route-line" d="M147 260H278" />
    <path className="route-line" d="M434 260H565" />
    <path className="route-return" d="M573 298C510 410 210 410 148 298" />
    <text className="route-label" x="360" y="145" textAnchor="middle">Matched by service and area</text>
    <text className="route-label" x="360" y="430" textAnchor="middle">Replies return for comparison</text>
    <g className="route-node route-node-request"><rect x="40" y="206" width="108" height="108" /><path d="M70 237h48M70 257h34M70 277h42" /><text x="94" y="340" textAnchor="middle">Your request</text></g>
    <g className="route-core"><rect x="286" y="186" width="148" height="148" /><path d="M319 219h82v82h-82zM319 260h82M360 219v82" /><text x="360" y="360" textAnchor="middle">JSV Market</text></g>
    <g className="route-node"><rect x="573" y="206" width="108" height="108" /><path d="M603 280v-38h48v38M597 280h60M614 242v-12h26v12" /><text x="627" y="340" textAnchor="middle">Local businesses</text></g>
  </svg>
}

function AccountSheet({ user, close }: { user: User | null; close: () => void }) {
  const [mode, setMode] = useState<'create' | 'signin'>('create')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      if (mode === 'create') await customerCreateAccount(email.trim(), password)
      else await customerSignIn(email.trim(), password)
      close()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not continue.') }
    setBusy(false)
  }

  const member = Boolean(user && !user.isAnonymous)
  return <div className="mobile-sheet-backdrop" onMouseDown={close}><section className="mobile-sheet account-dialog" role="dialog" aria-modal="true" aria-label="Customer account" onMouseDown={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-title"><div><span>Your JSV Market</span><h2>{member ? 'Your account' : mode === 'create' ? 'Create your account' : 'Welcome back'}</h2></div><button type="button" className="sheet-close" aria-label="Close account panel" onClick={close}>✕</button></div>{member ? <div className="member-sheet"><span>Signed in as</span><strong>{user?.email}</strong><button type="button" className="secondary" onClick={() => void logOut()}>Sign out</button></div> : <><div className="provider-auth-tabs"><button type="button" className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>Create account</button><button type="button" className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Sign in</button></div>{error && <div className="notice error">{error}</div>}<form className="provider-auth-form" onSubmit={submit}><label>Email<input name="email" autoComplete="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Password<input name="password" autoComplete={mode === 'create' ? 'new-password' : 'current-password'} type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></label><button type="submit" className="primary" disabled={busy}>{busy ? 'Working…' : mode === 'create' ? 'Create account' : 'Sign in'}</button></form><p className="integration-note">Creating an account upgrades your current guest session, so requests made on this device stay with you.</p></>}<div className="sheet-support"><span>Need a hand?</span><a href="tel:+971585235595">+971 58 523 5595</a><a href="mailto:support@market.jsventures.me">support@market.jsventures.me</a></div></section></div>
}

function ReviewForm({ booking, review }: { booking: Booking; review?: Review }) {
  const [rating, setRating] = useState(review?.rating ?? 0)
  const [comment, setComment] = useState(review?.comment ?? '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(Boolean(review))
  const [error, setError] = useState('')
  if (booking.status !== 'completed') return null
  if (saved || review) return <div className="review-saved"><strong>{'★'.repeat(review?.rating || rating)} Review submitted</strong></div>
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { await submitReview(booking, rating, comment); setSaved(true) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not submit review.') }
    setBusy(false)
  }
  return <form className="review-panel" onSubmit={submit}><strong>How did it go?</strong><div className="star-row">{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} className={value <= rating ? 'selected' : ''} onClick={() => setRating(value)}>★</button>)}</div><textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional comment" />{error && <div className="account-error">{error}</div>}<button className="primary compact" disabled={!rating || busy}>{busy ? 'Submitting…' : 'Submit review'}</button></form>
}

function Home() {
  const { user } = useCurrentUser()
  const [tab, setTab] = useState<'home' | 'how' | 'requests' | 'bookings'>('home')
  const [accountOpen, setAccountOpen] = useState(false)
  const [queryText, setQueryText] = useState('')
  const [location, setLocation] = useState('')
  const [budget, setBudget] = useState('')
  const [contactPhone, setContactPhone] = useState(() => window.localStorage.getItem('jsv-market-contact-phone') || '')
  const [shareContactConsent, setShareContactConsent] = useState(false)
  const [urgency, setUrgency] = useState<Urgency>('now')
  const [scheduledFor, setScheduledFor] = useState('')
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user || !firebaseConfigured) return
    const stops = [watchMyRequests(user.uid, setRequests), watchCustomerBookings(user.uid, setBookings), watchCustomerReviews(user.uid, setReviews)]
    return () => stops.forEach((stop) => stop())
  }, [user])

  const phoneDigits = contactPhone.replace(/\D/g, '')
  const canSubmit = useMemo(() => firebaseConfigured && queryText.trim().length >= 8 && location.trim().length >= 2 && phoneDigits.length >= 8 && phoneDigits.length <= 15 && shareContactConsent && (urgency !== 'scheduled' || Boolean(scheduledFor)), [queryText, location, phoneDigits, shareContactConsent, urgency, scheduledFor])
  const activeRequests = requests.filter((item) => item.status === 'open')
  const activeBookings = bookings.filter((item) => item.status === 'booked' || item.status === 'in_progress')
  const reviewByBooking = new Map(reviews.map((review) => [review.bookingId, review]))

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) {
      setError(!firebaseConfigured
        ? 'Requests are not connected in this preview.'
        : queryText.trim().length < 8
          ? 'Add a little more detail about the job.'
          : location.trim().length < 2
            ? 'Add the service location.'
            : phoneDigits.length < 8 || phoneDigits.length > 15
              ? 'Enter a valid WhatsApp or mobile number.'
              : !shareContactConsent
                ? 'Confirm that a matched business may contact you.'
                : 'Choose when you need the service.')
      return
    }
    setSaving(true); setError('')
    try {
      window.localStorage.setItem('jsv-market-contact-phone', contactPhone.trim())
      const parsed = parseDraft({ query: queryText.trim(), location: location.trim(), budget: budget ? Number(budget) : undefined, urgency, scheduledFor: urgency === 'scheduled' ? scheduledFor : undefined, contactPhone: contactPhone.trim(), shareContactConsent })
      const id = await createServiceRequest(parsed)
      window.location.assign(`/request/${id}`)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create request.'); setSaving(false) }
  }

  const go = (next: 'home' | 'how' | 'requests' | 'bookings') => { setTab(next); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  return <main className="customer-v2-shell"><a className="hm-skip" href="#main-content">Skip to content</a><header className="customer-v2-header"><button type="button" className="customer-v2-brand" onClick={() => go('home')} aria-label="JSV Market home"><JsvWordmark /></button><nav className="customer-v2-nav" aria-label="Primary"><button type="button" className={tab === 'home' ? 'active' : ''} onClick={() => go('home')}>Home</button><button type="button" className={tab === 'how' ? 'active' : ''} onClick={() => go('how')}>How it works</button><button type="button" className={tab === 'requests' ? 'active' : ''} onClick={() => go('requests')}>Requests{activeRequests.length ? <b>{activeRequests.length}</b> : null}</button><button type="button" className={tab === 'bookings' ? 'active' : ''} onClick={() => go('bookings')}>Bookings{activeBookings.length ? <b>{activeBookings.length}</b> : null}</button></nav><div className="customer-v2-actions"><a href="/provider">For businesses</a><button type="button" className="account-button" onClick={() => setAccountOpen(true)}>{user && !user.isAnonymous ? 'Account' : 'Sign in'}</button></div></header>

    {tab === 'home' && <div className="customer-v2-content" id="main-content"><section className="jsv-hero"><div className="jsv-hero-copy"><h1>Ask once. Choose who answers.</h1><p>Send one local-service request and compare replies from relevant businesses.</p><a className="jsv-primary-link" href="#jsv-market-request">Post a request</a>{activeBookings.length > 0 && <a className="active-job-pill" href="#bookings" onClick={() => go('bookings')}>{activeBookings.length} active job{activeBookings.length === 1 ? '' : 's'}</a>}</div><div className="jsv-hero-graphic"><MarketRouteGraphic /></div></section>

      <section className="jsv-request-section"><div className="jsv-request-intro"><h2>Put the job on the market.</h2><p>Explain the outcome, location and timing. JSV Market routes it to businesses that may be able to help.</p><div className="jsv-request-note"><span>One request</span><span>Relevant replies</span><span>Your choice</span></div></div><form id="jsv-market-request" className="request-card app-request-card" onSubmit={submit}><div className="request-card-heading"><h2>What do you need?</h2></div><label className="search-field"><span>Describe the job</span><textarea name="request" value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="My AC stopped cooling in Al Barsha today." rows={3} minLength={8} required /></label><div className="form-grid"><label><span>Location</span><LocationInput value={location} onChange={setLocation} required /></label><label><span>Maximum budget</span><div className="money-input"><b>AED</b><input name="budget" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))} placeholder="Optional" /></div></label></div><div className="form-grid"><label><span>WhatsApp or mobile</span><input name="phone" autoComplete="tel" type="tel" inputMode="tel" minLength={8} maxLength={20} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="9715XXXXXXXX" required /></label><p className="integration-note">Shared only with a business matched to this request.</p></div><label className="integration-note consent-line"><input type="checkbox" checked={shareContactConsent} onChange={(e) => setShareContactConsent(e.target.checked)} required /> I agree that JSV Market may share my number with a matched business so they can contact me about this request.</label><fieldset className="urgency-row"><legend>When do you need it?</legend>{(['now', 'today', 'scheduled'] as Urgency[]).map((value) => <button type="button" className={urgency === value ? 'chip active' : 'chip'} onClick={() => setUrgency(value)} key={value}>{value === 'now' ? 'Now' : value === 'today' ? 'Today' : 'Choose time'}</button>)}</fieldset>{urgency === 'scheduled' && <div className="inline-field"><label>When?</label><input name="scheduledFor" type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} required /></div>}{error && <div className="notice error">{error}</div>}<button type="submit" className="primary request-submit" disabled={saving} aria-disabled={saving}>{saving ? 'Sending request…' : 'Post request'}</button></form></section>

      {(activeRequests.length > 0 || activeBookings.length > 0) && <section className="app-live-strip"><div><span>Your JSV Market</span><strong>{activeRequests.length} open request{activeRequests.length === 1 ? '' : 's'}<br />{activeBookings.length} active booking{activeBookings.length === 1 ? '' : 's'}</strong></div><button type="button" onClick={() => go(activeBookings.length ? 'bookings' : 'requests')}>Open activity</button></section>}

      <section className="home-quicklinks"><button type="button" onClick={() => go('how')}>New here? See how JSV Market works →</button></section>
    </div>}

    {tab === 'how' && <div className="customer-v2-content" id="main-content"><section className="home-how"><div className="home-section-copy"><h2>A market built around the job.</h2><p>Businesses respond to the same brief, so their timing, details and quotes are easier to compare.</p></div><ol className="home-steps"><li><JsvMark /><h3>Post the need</h3><p>Describe the outcome, area and timing.</p></li><li><svg viewBox="0 0 44 44" aria-hidden="true"><path d="M5 22h34M27 10l12 12-12 12" /></svg><h3>Reach the right businesses</h3><p>JSV Market routes the request by service and location.</p></li><li><svg viewBox="0 0 44 44" aria-hidden="true"><path d="M6 9h32v26H6zM13 17h18M13 27h11" /></svg><h3>Compare replies</h3><p>Choose the response that fits the job.</p></li></ol></section>

      <section className="home-need"><div className="home-need-copy"><h2>Start with what happened.</h2><p>No category knowledge needed. Write the request as you would explain it to a local business.</p></div><div className="home-example-list" aria-label="Example requests"><div><strong>My AC stopped cooling this morning.</strong><span>Home repair</span></div><div><strong>I need someone to mount a TV tonight.</strong><span>Odd jobs</span></div><div><strong>My car battery is dead at home.</strong><span>Auto help</span></div><div><strong>I need a sofa deep cleaned this week.</strong><span>Cleaning</span></div></div></section>

      <section className="jsv-provider-band"><div><h2>Receive JSV Market requests.</h2><p>Join as a local business and reply with your availability and quote.</p></div><a href="/provider">Open the business portal</a></section>

      <section className="jsv-contact"><div className="jsv-contact-copy"><h2>Talk to a person.</h2><p>Questions about a request, a booking or a business account? The JSV Market team is a message away.</p></div><div className="jsv-contact-list"><a href="tel:+971585235995"><span>Call or WhatsApp</span><strong>+971 58 523 5995</strong></a><a href="mailto:support@market.jsventures.me"><span>Email support</span><strong>support@market.jsventures.me</strong></a></div></section>
    </div>}

    {tab === 'requests' && <div className="customer-v2-content tab-page" id="main-content"><div className="tab-page-title"><h1>Your requests</h1><p>What you’ve asked JSV Market to help with.</p></div><div className="list-stack">{requests.map((request) => <a className="app-list-card" href={`/request/${request.id}`} key={request.id}><div><strong>{request.query}</strong><span>{request.location}<br />{request.category}</span></div><b className={`status ${request.status}`}>{request.status}</b></a>)}{!requests.length && <div className="empty-state large">You have no requests yet. <button type="button" className="empty-cta" onClick={() => go('home')}>Post your first request →</button></div>}</div></div>}

    {tab === 'bookings' && <div id="main-content" className="customer-v2-content tab-page"><div className="tab-page-title"><h1>Your jobs</h1><p>People JSV Market has helped you book.</p></div><div className="booking-grid">{bookings.map((booking) => <article className="customer-booking-card" key={booking.id}><div className="booking-card-top"><div><strong>{booking.providerName}</strong><p>AED {booking.amount}</p></div><span className={`status ${booking.status}`}>{booking.status.replace('_', ' ')}</span></div><div className="booking-actions">{booking.providerPhone && <a href={`tel:${booking.providerPhone}`}>Call</a>}{booking.providerWhatsapp && <a href={`https://wa.me/${booking.providerWhatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>}{booking.checkoutUrl && <a href={booking.checkoutUrl} target="_blank" rel="noreferrer">Provider checkout</a>}<a href={`/request/${booking.requestId}`}>Request</a></div><ReviewForm booking={booking} review={reviewByBooking.get(booking.id)} /></article>)}{!bookings.length && <div className="empty-state large">No bookings yet.</div>}</div></div>}

    <nav className="customer-mobile-nav" aria-label="JSV Market navigation"><button type="button" className={tab === 'home' ? 'active' : ''} onClick={() => go('home')}><span aria-hidden="true">⌂</span>Home</button><button type="button" className={tab === 'how' ? 'active' : ''} onClick={() => go('how')}><span aria-hidden="true">？</span>How</button><button type="button" className={tab === 'requests' ? 'active' : ''} onClick={() => go('requests')}><span aria-hidden="true">✎</span>Requests{activeRequests.length ? <b>{activeRequests.length}</b> : null}</button><button type="button" className={tab === 'bookings' ? 'active' : ''} onClick={() => go('bookings')}><span aria-hidden="true">✓</span>Bookings{activeBookings.length ? <b>{activeBookings.length}</b> : null}</button><button type="button" onClick={() => setAccountOpen(true)}><span aria-hidden="true">◎</span>Account</button></nav>
    {accountOpen && <AccountSheet user={user} close={() => setAccountOpen(false)} />}
  </main>
}

function RequestPage({ requestId }: { requestId: string }) {
  const { user, ready } = useCurrentUser()
  const [accountOpen, setAccountOpen] = useState(false)
  const [request, setRequest] = useState<ServiceRequest | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [error, setError] = useState('')
  const [working, setWorking] = useState('')
  const [accepted, setAccepted] = useState<{ bookingId: string; providerName: string; checkoutUrl?: string | null; checkoutProvider?: string | null; checkoutHost?: string | null } | null>(null)

  useEffect(() => {
    if (!firebaseConfigured || !user) return
    const a = watchRequest(requestId, setRequest)
    const b = watchQuotesForRequest(requestId, setQuotes)
    return () => { a(); b() }
  }, [requestId, user])

  async function choose(quote: Quote) {
    if (!request) return
    setWorking(quote.id); setError('')
    try {
      const result = await acceptQuoteWithCheckout(request, quote)
      setAccepted({ bookingId: result.bookingId, providerName: result.providerName, checkoutUrl: result.checkoutUrl, checkoutProvider: result.checkoutProvider, checkoutHost: result.checkoutHost })
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not accept quote.') }
    setWorking('')
  }

  async function cancel() {
    if (!request) return
    setWorking('cancel'); setError('')
    try { await cancelRequest(request) } catch (err) { setError(err instanceof Error ? err.message : 'Could not cancel request.') }
    setWorking('')
  }

  if (!firebaseConfigured) return <main className="customer-v2-shell"><div className="notice error">Firebase is not configured.</div></main>
  if (!ready) return <main className="customer-v2-shell"><div className="provider-loading">Loading…</div></main>
  if (!user) return <main className="customer-v2-shell"><div className="notice error">Sign in to view this request.</div></main>

  return <main className="customer-v2-shell"><header className="customer-v2-header"><a className="back-link" href="/">Home</a><a className="brand" href="/">JSV Market<span>.</span></a><span /></header><div className="customer-v2-content tab-page">{!request ? <div className="provider-loading">Loading request…</div> : <><div className="request-detail-v2"><div className="request-title-row"><div><h1>{request.query}</h1><span className="request-context">{request.urgency === 'now' ? 'Need it now' : 'Service request'}</span></div><span className={`status large ${request.status}`}>{request.status}</span></div><div className="request-facts"><div><span>Where</span><strong>{request.location}</strong></div><div><span>Budget</span><strong>{request.budget ? `Up to AED ${request.budget}` : 'Open'}</strong></div><div><span>Service</span><strong>{request.category}</strong></div></div></div>{request.externalMatchStatus === 'provider_interested' && <div className="success-panel"><strong>A business is interested.</strong><p>JSV Market has shared your contact details with the matched business. They should contact you directly.</p></div>}{request.externalMatchStatus === 'provider_contacted' && <div className="notice"><strong>JSV Market is contacting a local business.</strong> We will keep this request updated as soon as someone responds.</div>}{request.externalMatchStatus === 'needs_match' && <div className="notice">JSV Market is looking for someone who can help.</div>}{error && <div className="notice error">{error}</div>}

    {accepted && <section className="checkout-choice"><h2>Booking confirmed</h2><p>Your booking with {accepted.providerName} is confirmed.</p><div className="checkout-options">{import.meta.env.VITE_JSV_MARKET_CHECKOUT_ENABLED === 'true' && <button className="checkout-option" type="button" onClick={() => user.isAnonymous ? setAccountOpen(true) : void startNetworkCheckout(accepted.bookingId).then(({ paymentUrl }) => window.location.assign(paymentUrl)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not open JSV Market checkout.'))}><div><strong>{user.isAnonymous ? 'Sign in to pay online' : 'Pay with JSV Market'}</strong><span>Processed by Network International</span></div></button>}{accepted.checkoutUrl && <button className="checkout-option" type="button" onClick={() => window.location.assign(accepted.checkoutUrl!)}><div><strong>Pay {accepted.providerName}</strong><span>{accepted.checkoutProvider || 'Provider checkout'}<br />{accepted.checkoutHost}</span></div></button>}</div>{!accepted.checkoutUrl && import.meta.env.VITE_JSV_MARKET_CHECKOUT_ENABLED !== 'true' && <div className="empty-state"><strong>Arrange payment with the provider.</strong><p>Online checkout is not enabled for this booking.</p></div>}<a className="text-button" href="/">Return home</a></section>}

    {!accepted && request.status === 'open' && <section className="quote-section"><div className="section-heading"><h2>Choose a provider</h2><span>{quotes.length} quote{quotes.length === 1 ? '' : 's'}</span></div>{!quotes.length ? <div className="empty-state large"><strong>JSV Market is looking.</strong><p>You do not need to call around. We are finding someone who can help and they may contact you directly.</p></div> : <div className="quote-grid">{quotes.map((quote) => <article className="quote-card" key={quote.id}><div className="quote-top"><div><strong>{quote.providerName}</strong><p>{quote.etaMinutes ? `ETA ${quote.etaMinutes} min` : 'ETA not supplied'}{quote.checkoutHost ? <><br />Checkout: {quote.checkoutHost}</> : ''}</p></div><b>AED {quote.amount}</b></div>{quote.message && <p className="quote-message">{quote.message}</p>}<button type="button" className="primary" disabled={working === quote.id} onClick={() => void choose(quote)}>{working === quote.id ? 'Booking…' : `Accept AED ${quote.amount}`}</button></article>)}</div>}<button type="button" className="danger-link" disabled={working === 'cancel'} onClick={() => void cancel()}>{working === 'cancel' ? 'Cancelling…' : 'Cancel request'}</button></section>}

    {!accepted && request.status === 'booked' && <div className="success-panel"><strong>Booked.</strong><p>Your booking is confirmed. Open the Bookings tab on the JSV Market home screen for provider contact and payment options.</p></div>}
    {request.status === 'completed' && <div className="success-panel"><strong>Job completed.</strong><p>You can review the provider from your Bookings tab.</p></div>}
    {request.status === 'cancelled' && <div className="empty-state large"><strong>Request cancelled.</strong></div>}</>}</div>{accountOpen && <AccountSheet user={user} close={() => setAccountOpen(false)} />}</main>
}

export default function CustomerAppV2() {
  const path = window.location.pathname
  const requestMatch = path.match(/^\/request\/([^/]+)/)
  if (requestMatch) return <RequestPage requestId={requestMatch[1]} />
  return <Home />
}
