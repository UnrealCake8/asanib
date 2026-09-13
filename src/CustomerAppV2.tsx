import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import LocationInput from './LocationInput'
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
import { acceptQuoteWithCheckout } from './lib/marketplaceApi'
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
  return <div className="mobile-sheet-backdrop" onMouseDown={close}><section className="mobile-sheet" onMouseDown={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-title"><div><span>YOUR ASANIB</span><h2>{member ? 'Account' : mode === 'create' ? 'Save your Asanib' : 'Welcome back'}</h2></div><button type="button" onClick={close}>×</button></div>{member ? <div className="member-sheet"><span>Signed in as</span><strong>{user?.email}</strong><button className="secondary" onClick={() => void logOut()}>Sign out</button></div> : <><div className="provider-auth-tabs"><button className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>Create account</button><button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Sign in</button></div>{error && <div className="notice error">{error}</div>}<form className="provider-auth-form" onSubmit={submit}><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Password<input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></label><button className="primary" disabled={busy}>{busy ? 'Working…' : mode === 'create' ? 'Create account' : 'Sign in'}</button></form><p className="integration-note">Creating an account upgrades your current guest session, so requests made on this device stay with you.</p></>}</section></div>
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
  const [tab, setTab] = useState<'home' | 'requests' | 'bookings'>('home')
  const [accountOpen, setAccountOpen] = useState(false)
  const [queryText, setQueryText] = useState('')
  const [location, setLocation] = useState('')
  const [budget, setBudget] = useState('')
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

  const canSubmit = useMemo(() => firebaseConfigured && queryText.trim().length >= 8 && location.trim().length >= 2 && (urgency !== 'scheduled' || Boolean(scheduledFor)), [queryText, location, urgency, scheduledFor])
  const activeRequests = requests.filter((item) => item.status === 'open')
  const activeBookings = bookings.filter((item) => item.status === 'booked' || item.status === 'in_progress')
  const reviewByBooking = new Map(reviews.map((review) => [review.bookingId, review]))

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setSaving(true); setError('')
    try {
      const parsed = parseDraft({ query: queryText.trim(), location: location.trim(), budget: budget ? Number(budget) : undefined, urgency, scheduledFor: urgency === 'scheduled' ? scheduledFor : undefined })
      const id = await createServiceRequest(parsed)
      window.location.assign(`/request/${id}`)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create request.'); setSaving(false) }
  }

  return <main className="customer-v2-shell"><header className="customer-v2-header"><a className="brand" href="/">asanib<span>.</span></a><div className="customer-v2-actions"><a href="/provider">For businesses</a><button type="button" onClick={() => setAccountOpen(true)}>{user && !user.isAnonymous ? 'Account' : 'Sign in'}</button></div></header>

    {tab === 'home' && <div className="customer-v2-content"><section className="app-welcome"><div><span>JUST ASK ASANIB</span><h1>What do you need?</h1><p>Tell Asanib what you need. We’ll find someone who can help.</p></div>{activeBookings.length > 0 && <a className="active-job-pill" href="#bookings" onClick={() => setTab('bookings')}>{activeBookings.length} active job{activeBookings.length === 1 ? '' : 's'} →</a>}</section>

      <form id="asanib-request" className="request-card app-request-card" onSubmit={submit}><div className="request-card-heading"><div><span>ASK ASANIB</span><strong>What can we sort out for you?</strong></div></div><label className="search-field"><span className="search-icon">⌕</span><textarea value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="e.g. My AC stopped cooling. I need someone in Al Barsha today." rows={3} /></label><div className="form-grid"><label><span>Where?</span><LocationInput value={location} onChange={setLocation} required /></label><label><span>Maximum budget</span><div className="money-input"><b>AED</b><input inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))} placeholder="Optional" /></div></label></div><div className="urgency-row">{(['now', 'today', 'scheduled'] as Urgency[]).map((value) => <button type="button" className={urgency === value ? 'chip active' : 'chip'} onClick={() => setUrgency(value)} key={value}>{value === 'now' ? '⚡ Now' : value === 'today' ? 'Today' : 'Choose time'}</button>)}</div>{urgency === 'scheduled' && <div className="inline-field"><label>When?</label><input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} required /></div>}{error && <div className="notice error">{error}</div>}<button className="primary request-submit" disabled={!canSubmit || saving}>{saving ? 'Asanib is looking…' : 'Ask Asanib'}</button></form>

      {(activeRequests.length > 0 || activeBookings.length > 0) && <section className="app-live-strip"><div><span>YOUR ASANIB</span><strong>{activeRequests.length} open request{activeRequests.length === 1 ? '' : 's'} · {activeBookings.length} active booking{activeBookings.length === 1 ? '' : 's'}</strong></div><button type="button" onClick={() => setTab(activeBookings.length ? 'bookings' : 'requests')}>Open →</button></section>}

      <section className="home-how"><div className="home-section-copy"><span>HOW IT WORKS</span><h2>You ask once, Asanib does the searching.</h2><p>No directories to dig through and no explaining the same problem over and over. Tell us what is going on, then compare the help Asanib finds for you.</p></div><div className="home-steps"><article><b>01</b><h3>Tell Asanib</h3><p>Describe what you need in normal words, including where you are and when you need it.</p></article><article><b>02</b><h3>We look for the right help</h3><p>Asanib gets your request in front of relevant local businesses and people who can help.</p></article><article><b>03</b><h3>You choose</h3><p>Compare the options that come back, then book the one that works for you.</p></article></div></section>

      <section className="home-need"><div className="home-need-copy"><span>NOT SURE WHO TO CALL?</span><h2>That is exactly what Asanib is for.</h2><p>You do not need to know the job title, the service category, or which company to search for. Start with the problem. Asanib figures out who might be able to help.</p></div><div className="home-example-list" aria-label="Example requests"><div><strong>“My AC stopped cooling this morning.”</strong><span>Home repair</span></div><div><strong>“I need someone to mount a TV tonight.”</strong><span>Odd jobs</span></div><div><strong>“My car battery is dead at home.”</strong><span>Auto help</span></div><div><strong>“I need a sofa deep cleaned this week.”</strong><span>Cleaning</span></div></div></section>

      <section className="home-principles"><div><span>ONE REQUEST</span><strong>Stop calling around</strong><p>Explain the job once and keep the request in one place.</p></div><div><span>LOCAL OPTIONS</span><strong>See who can actually help</strong><p>Asanib looks for people relevant to your request and location.</p></div><div><span>YOUR CHOICE</span><strong>You stay in control</strong><p>Compare what comes back before you decide who to book.</p></div></section>
    </div>}

    {tab === 'requests' && <div className="customer-v2-content tab-page"><div className="tab-page-title"><span>REQUESTS</span><h1>Your requests</h1><p>What you’ve asked Asanib to help with.</p></div><div className="list-stack">{requests.map((request) => <a className="app-list-card" href={`/request/${request.id}`} key={request.id}><div><strong>{request.query}</strong><span>{request.location} · {request.category}</span></div><b className={`status ${request.status}`}>{request.status}</b></a>)}{!requests.length && <div className="empty-state large">You have no requests yet.</div>}</div></div>}

    {tab === 'bookings' && <div id="bookings" className="customer-v2-content tab-page"><div className="tab-page-title"><span>BOOKINGS</span><h1>Your jobs</h1><p>People Asanib has helped you book.</p></div><div className="booking-grid">{bookings.map((booking) => <article className="customer-booking-card" key={booking.id}><div className="booking-card-top"><div><strong>{booking.providerName}</strong><p>AED {booking.amount}</p></div><span className={`status ${booking.status}`}>{booking.status.replace('_', ' ')}</span></div><div className="booking-actions">{booking.providerPhone && <a href={`tel:${booking.providerPhone}`}>Call</a>}{booking.providerWhatsapp && <a href={`https://wa.me/${booking.providerWhatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>}{booking.checkoutUrl && <a href={booking.checkoutUrl} target="_blank" rel="noreferrer">Provider checkout</a>}<a href={`/request/${booking.requestId}`}>Request</a></div><ReviewForm booking={booking} review={reviewByBooking.get(booking.id)} /></article>)}{!bookings.length && <div className="empty-state large">No bookings yet.</div>}</div></div>}

    <nav className="customer-mobile-nav" aria-label="Asanib navigation"><button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}><span>⌂</span>Home</button><button className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}><span>⌕</span>Requests{activeRequests.length ? <b>{activeRequests.length}</b> : null}</button><button className={tab === 'bookings' ? 'active' : ''} onClick={() => setTab('bookings')}><span>✓</span>Bookings{activeBookings.length ? <b>{activeBookings.length}</b> : null}</button><button onClick={() => setAccountOpen(true)}><span>◉</span>Account</button></nav>
    {accountOpen && <AccountSheet user={user} close={() => setAccountOpen(false)} />}
  </main>
}

function RequestPage({ requestId }: { requestId: string }) {
  const { user, ready } = useCurrentUser()
  const [request, setRequest] = useState<ServiceRequest | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [error, setError] = useState('')
  const [working, setWorking] = useState('')
  const [accepted, setAccepted] = useState<{ providerName: string; checkoutUrl?: string | null; checkoutProvider?: string | null; checkoutHost?: string | null } | null>(null)

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
      setAccepted({ providerName: result.providerName, checkoutUrl: result.checkoutUrl, checkoutProvider: result.checkoutProvider, checkoutHost: result.checkoutHost })
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

  return <main className="customer-v2-shell"><header className="customer-v2-header"><a className="back-link" href="/">← Home</a><a className="brand" href="/">asanib<span>.</span></a><span /></header><div className="customer-v2-content tab-page">{!request ? <div className="provider-loading">Loading request…</div> : <><div className="request-detail-v2"><div className="request-title-row"><div><span className="eyebrow">{request.urgency === 'now' ? 'NEED IT NOW' : 'SERVICE REQUEST'}</span><h1>{request.query}</h1></div><span className={`status large ${request.status}`}>{request.status}</span></div><div className="request-facts"><div><span>Where</span><strong>{request.location}</strong></div><div><span>Budget</span><strong>{request.budget ? `Up to AED ${request.budget}` : 'Open'}</strong></div><div><span>Service</span><strong>{request.category}</strong></div></div></div>{error && <div className="notice error">{error}</div>}

    {accepted && <section className="checkout-choice"><span className="eyebrow">BOOKING CONFIRMED</span><h2>How would you like to pay?</h2><p>You booked {accepted.providerName}. Payment options are kept separate so you can clearly see who is processing the payment.</p><div className="checkout-options">{request.urgency !== 'scheduled' && import.meta.env.VITE_ASANIB_CHECKOUT_ENABLED === 'true' && <button className="checkout-option asanib-checkout" type="button"><div><strong>Asanib Checkout</strong><span>Pay inside Asanib · powered by Ziina</span></div><b>→</b></button>}{accepted.checkoutUrl && <button className="checkout-option" type="button" onClick={() => window.location.assign(accepted.checkoutUrl!)}><div><strong>Pay {accepted.providerName}</strong><span>{accepted.checkoutProvider || 'Provider checkout'} · {accepted.checkoutHost}</span></div><b>↗</b></button>}</div>{!accepted.checkoutUrl && <div className="empty-state"><strong>No online provider checkout is configured.</strong><p>Contact the provider to arrange payment.</p></div>}<a className="text-button" href="/">Pay later / return home</a></section>}

    {!accepted && request.status === 'open' && <section className="quote-section"><div className="section-heading"><div><span className="section-kicker">QUOTES</span><h2>Choose a provider</h2></div><span>{quotes.length}</span></div>{!quotes.length ? <div className="empty-state large"><strong>No quotes yet.</strong><p>Asanib is still looking for someone who can help.</p></div> : <div className="quote-grid">{quotes.map((quote) => <article className="quote-card" key={quote.id}><div className="quote-top"><div><strong>{quote.providerName}</strong><p>{quote.etaMinutes ? `ETA ${quote.etaMinutes} min` : 'ETA not supplied'}{quote.checkoutHost ? ` · checkout: ${quote.checkoutHost}` : ''}</p></div><b>AED {quote.amount}</b></div>{quote.message && <p className="quote-message">{quote.message}</p>}<button className="primary" disabled={working === quote.id} onClick={() => void choose(quote)}>{working === quote.id ? 'Booking…' : `Accept AED ${quote.amount}`}</button></article>)}</div>}<button className="danger-link" disabled={working === 'cancel'} onClick={() => void cancel()}>{working === 'cancel' ? 'Cancelling…' : 'Cancel request'}</button></section>}

    {!accepted && request.status === 'booked' && <div className="success-panel"><strong>Booked.</strong><p>Your booking is confirmed. Open the Bookings tab on the Asanib home screen for provider contact and payment options.</p></div>}
    {request.status === 'completed' && <div className="success-panel"><strong>Job completed.</strong><p>You can review the provider from your Bookings tab.</p></div>}
    {request.status === 'cancelled' && <div className="empty-state large"><strong>Request cancelled.</strong></div>}</>}</div></main>
}

export default function CustomerAppV2() {
  const path = window.location.pathname
  const requestMatch = path.match(/^\/request\/([^/]+)/)
  if (requestMatch) return <RequestPage requestId={requestMatch[1]} />
  return <Home />
}
