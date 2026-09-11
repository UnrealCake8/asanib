import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import { firebaseConfigured } from './lib/firebase'
import {
  acceptQuote,
  cancelRequest,
  createServiceRequest,
  logOut,
  matchingRequests,
  providerSignIn,
  providerSignUp,
  saveProviderProfile,
  setProviderAvailability,
  submitQuote,
  updateBookingStatus,
  watchAuth,
  watchCustomerBookings,
  watchMyProviderQuotes,
  watchMyRequests,
  watchOpenRequests,
  watchProviderBookings,
  watchProviderProfile,
  watchQuotesForRequest,
  watchRequest,
} from './lib/data'
import { setProviderApproved, watchAdminAccess, watchAllProviders, watchAllRequests } from './lib/admin'
import type { Booking, ParsedRequest, ProviderProfile, Quote, ServiceRequest, ServiceRequestDraft, Urgency } from './types'

const serviceCategories = ['Home services', 'Send & errands', 'Auto services', 'Beauty', 'Local services']
const categoryCards = [
  { icon: '⌂', title: 'Home services', copy: 'Cleaning, AC, plumbing, electrical and handyman jobs.', prompt: 'I need a home service provider' },
  { icon: '↗', title: 'Send & errands', copy: 'Couriers, pickups, deliveries, moving and everyday errands.', prompt: 'I need someone to collect and deliver something' },
  { icon: '◉', title: 'Auto services', copy: 'Mobile car wash, battery, tyre and roadside help.', prompt: 'I need help with my car' },
  { icon: '✦', title: 'Beauty', copy: 'Find mobile and local beauty professionals around you.', prompt: 'I need a beauty service near me' },
  { icon: '＋', title: 'Local services', copy: 'For everything else: describe the job and let providers respond.', prompt: 'I need someone local who can help me with' },
]

const examples = [
  'AC technician in Al Barsha right now under AED 200',
  'Sofa cleaning in Ajman tomorrow for under AED 180',
  'Someone to collect a package in Dubai and deliver it to Sharjah',
]

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

function ErrorBox({ message }: { message: string }) {
  return <div className="notice error">{message}</div>
}

function CustomerHome() {
  const { user } = useCurrentUser()
  const [queryText, setQueryText] = useState('')
  const [location, setLocation] = useState('')
  const [budget, setBudget] = useState('')
  const [urgency, setUrgency] = useState<Urgency>('now')
  const [scheduledFor, setScheduledFor] = useState('')
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user || !firebaseConfigured) return
    const stopRequests = watchMyRequests(user.uid, setRequests)
    const stopBookings = watchCustomerBookings(user.uid, setBookings)
    return () => { stopRequests(); stopBookings() }
  }, [user])

  const openCount = requests.filter((item) => item.status === 'open').length
  const activeBookings = bookings.filter((item) => item.status === 'booked' || item.status === 'in_progress').length
  const canSubmit = useMemo(() => firebaseConfigured && queryText.trim().length >= 8 && location.trim().length >= 2 && (urgency !== 'scheduled' || Boolean(scheduledFor)), [queryText, location, urgency, scheduledFor])

  function jumpToRequest(prompt: string) {
    setQueryText(prompt)
    window.setTimeout(() => document.getElementById('request-box')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 20)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError('')
    try {
      const parsed = parseDraft({
        query: queryText.trim(),
        location: location.trim(),
        budget: budget ? Number(budget) : undefined,
        urgency,
        scheduledFor: urgency === 'scheduled' ? scheduledFor : undefined,
      })
      const id = await createServiceRequest(parsed)
      window.location.assign(`/request/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create request.')
      setSaving(false)
    }
  }

  return (
    <main className="page customer-home">
      <header className="topbar home-topbar">
        <a className="brand" href="/">asanib<span>.</span></a>
        <nav className="home-nav"><a href="#services">Services</a><a href="#how-it-works">How it works</a><a href="/provider">For providers</a></nav>
        <a className="provider-pill" href="/provider">List your business</a>
      </header>

      <section className="hero production-hero">
        <div className="hero-copy">
          <div className="eyebrow">LOCAL HELP, WITHOUT THE PHONE-TAG</div>
          <h1>Tell us what you need. <em>Let providers come to you.</em></h1>
          <p className="hero-lead">Describe the job once, set your area and budget, then compare quotes from relevant local providers instead of calling businesses one by one.</p>
          <div className="trust-row"><span>✓ No joining fee for customers</span><span>✓ Compare before choosing</span><span>✓ Pay the provider directly in V1</span></div>
        </div>

        {!firebaseConfigured && <ErrorBox message="Firebase is not connected yet. Add the values from .env.example to .env.local before requests can be posted." />}
        {error && <ErrorBox message={error} />}

        <form id="request-box" className="request-card production-request" onSubmit={submit}>
          <div className="request-card-heading"><div><span>Start a request</span><strong>What do you need done?</strong></div><div className="request-live"><i /> Providers respond with quotes</div></div>
          <label className="search-field">
            <span className="search-icon">⌕</span>
            <textarea value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="Describe the job in your own words — e.g. My AC stopped cooling. Need someone in Al Barsha now." rows={3} />
          </label>
          <div className="form-grid">
            <label><span>Where do you need help?</span><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Al Barsha, Dubai" required /></label>
            <label><span>Maximum budget</span><div className="money-input"><b>AED</b><input inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))} placeholder="Optional" /></div></label>
          </div>
          <div className="urgency-label">When do you need it?</div>
          <div className="urgency-row">
            {(['now', 'today', 'scheduled'] as Urgency[]).map((value) => <button type="button" className={urgency === value ? 'chip active' : 'chip'} onClick={() => setUrgency(value)} key={value}>{value === 'now' ? '⚡ Need it now' : value === 'today' ? 'Today' : 'Choose a time'}</button>)}
          </div>
          {urgency === 'scheduled' && <div className="inline-field"><label>When?</label><input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} required /></div>}
          <button className="primary request-submit" disabled={!canSubmit || saving}>{saving ? 'Posting request…' : 'Find providers'}</button>
          <p className="form-fineprint">Your request is only shared with authenticated provider accounts that can respond to jobs on Asanib.</p>
        </form>

        <div className="example-strip"><span>Popular requests:</span>{examples.map((example) => <button key={example} onClick={() => jumpToRequest(example)}>{example}</button>)}</div>
      </section>

      {(requests.length > 0 || bookings.length > 0) && <section className="account-snapshot">
        <div className="snapshot-copy"><span className="eyebrow">YOUR ASANIB</span><h2>Pick up where you left off.</h2><p>Your active requests and booked jobs stay right here on this device.</p></div>
        <div className="snapshot-stats"><div><strong>{openCount}</strong><span>Open requests</span></div><div><strong>{activeBookings}</strong><span>Active bookings</span></div><div><strong>{bookings.length}</strong><span>Total bookings</span></div></div>
      </section>}

      {requests.length > 0 && <section className="dashboard-section home-dashboard">
        <div className="section-heading"><div><span className="section-kicker">LIVE REQUESTS</span><h2>Your requests</h2></div><span>{requests.length}</span></div>
        <div className="list-stack">{requests.slice(0, 8).map((request) => <a className="list-card detailed-list-card" href={`/request/${request.id}`} key={request.id}><div><strong>{request.query}</strong><p>{request.location} · {request.category}{request.budget ? ` · up to AED ${request.budget}` : ''}</p></div><span className={`status ${request.status}`}>{request.status}</span></a>)}</div>
      </section>}

      {bookings.length > 0 && <section className="dashboard-section home-dashboard">
        <div className="section-heading"><div><span className="section-kicker">BOOKINGS</span><h2>Your booked providers</h2></div><span>{bookings.length}</span></div>
        <div className="booking-grid">{bookings.map((booking) => <article className="customer-booking-card" key={booking.id}><div className="booking-card-top"><div><strong>{booking.providerName}</strong><p>AED {booking.amount} · booking {booking.id.slice(0, 7)}</p></div><span className={`status ${booking.status}`}>{booking.status.replace('_', ' ')}</span></div><div className="booking-actions">{booking.providerPhone && <a href={`tel:${booking.providerPhone}`}>Call provider</a>}{booking.providerWhatsapp && <a href={`https://wa.me/${booking.providerWhatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>}<a href={`/request/${booking.requestId}`}>View request</a></div></article>)}</div>
      </section>}

      <section id="services" className="home-section services-section">
        <div className="section-intro"><div><span className="eyebrow">START WITH THE JOB</span><h2>One place for everyday local help.</h2></div><p>You do not need to know the exact business category. Pick something close, or just describe what needs doing.</p></div>
        <div className="service-card-grid">{categoryCards.map((category) => <button className="service-card" key={category.title} onClick={() => jumpToRequest(category.prompt)}><span className="service-icon">{category.icon}</span><strong>{category.title}</strong><p>{category.copy}</p><b>Start request →</b></button>)}</div>
      </section>

      <section id="how-it-works" className="home-section how-section">
        <div className="section-intro"><div><span className="eyebrow">HOW ASANIB WORKS</span><h2>Less searching. More getting it done.</h2></div><p>Asanib is built around a request, not a directory. You tell us the outcome you need; suitable providers decide whether to quote.</p></div>
        <div className="steps-grid"><article><span>01</span><h3>Describe the job</h3><p>Tell us what you need, where you need it, your timing and an optional maximum budget.</p></article><article><span>02</span><h3>Receive quotes</h3><p>Approved providers can respond with their price, ETA and what is included.</p></article><article><span>03</span><h3>Choose who fits</h3><p>Compare your options and accept the quote you want. Asanib creates the booking.</p></article><article><span>04</span><h3>Get it done</h3><p>Contact the accepted provider directly, follow booking progress and keep everything tied to the request.</p></article></div>
      </section>

      <section className="home-section confidence-section">
        <div className="confidence-main"><span className="eyebrow">BUILT FOR REAL-WORLD SERVICES</span><h2>Useful first. Flashy second.</h2><p>Asanib is not a list of random businesses dressed up as an AI answer. Provider accounts require approval before they can quote. Customers choose the quote; providers choose the jobs they want.</p><div className="confidence-points"><span>Provider approval controls</span><span>Quote-first marketplace</span><span>Clear booking states</span><span>Direct provider contact after booking</span></div></div>
        <aside className="need-now-card"><div className="pulse-dot" /><span>Need it now?</span><strong>Mark a request urgent.</strong><p>Providers who cover your category and service area can see the open job and respond with an ETA.</p><button onClick={() => { setUrgency('now'); jumpToRequest('I need someone who can help me right now with') }}>Post an urgent request</button></aside>
      </section>

      <section className="provider-cta">
        <div><span className="eyebrow">FOR LOCAL BUSINESSES</span><h2>Stop chasing every lead. Quote the jobs that fit.</h2><p>Create your service profile, choose the categories and areas you cover, and respond only when a request makes sense for your business.</p></div><a href="/provider">Join as a provider →</a>
      </section>

      <footer className="home-footer"><a className="brand" href="/">asanib<span>.</span></a><p>Everyday local help, made easier.</p><nav><a href="/provider">Provider portal</a><a href="/admin">Admin</a><a href="#services">Services</a></nav></footer>
    </main>
  )
}

function RequestPage({ requestId }: { requestId: string }) {
  const { user, ready } = useCurrentUser()
  const [request, setRequest] = useState<ServiceRequest | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [error, setError] = useState('')
  const [working, setWorking] = useState('')

  useEffect(() => {
    if (!firebaseConfigured || !user) return
    const stopRequest = watchRequest(requestId, setRequest)
    const stopQuotes = watchQuotesForRequest(requestId, setQuotes)
    return () => { stopRequest(); stopQuotes() }
  }, [requestId, user])

  async function choose(quote: Quote) {
    if (!request) return
    setWorking(quote.id); setError('')
    try { await acceptQuote(request, quote) } catch (err) { setError(err instanceof Error ? err.message : 'Could not accept quote.') }
    setWorking('')
  }

  async function cancel() {
    if (!request) return
    setWorking('cancel'); setError('')
    try { await cancelRequest(request) } catch (err) { setError(err instanceof Error ? err.message : 'Could not cancel request.') }
    setWorking('')
  }

  if (!firebaseConfigured) return <main className="page"><ErrorBox message="Firebase is not configured." /></main>
  if (!ready) return <main className="page"><p>Loading…</p></main>
  if (!user) return <main className="page"><ErrorBox message="This request belongs to a browser session that is no longer signed in." /></main>

  return <main className="page">
    <header className="topbar"><a className="back-link" href="/">← Requests</a><a className="brand" href="/">asanib<span>.</span></a><span /></header>
    <section className="request-detail">
      {!request ? <p>Loading request…</p> : <>
        <div className="request-title-row"><div><div className="eyebrow">{request.urgency === 'now' ? 'NEED IT NOW' : 'SERVICE REQUEST'}</div><h1>{request.query}</h1></div><span className={`status large ${request.status}`}>{request.status}</span></div>
        <div className="request-facts"><div><span>Category</span><strong>{request.category}</strong></div><div><span>Area</span><strong>{request.location}</strong></div><div><span>Budget</span><strong>{request.budget ? `Up to AED ${request.budget}` : 'Open to quotes'}</strong></div></div>
        {error && <ErrorBox message={error} />}
        {request.status === 'open' && <div className="quote-section"><div className="section-heading"><h2>Provider quotes</h2><span>{quotes.length}</span></div>{quotes.length === 0 ? <div className="empty-state"><strong>No quotes yet.</strong><p>Approved providers matching this job can see it and respond.</p></div> : <div className="quote-grid">{quotes.map((quote) => <article className="quote-card" key={quote.id}><div className="quote-top"><div><strong>{quote.providerName}</strong><p>{quote.etaMinutes ? `ETA ${quote.etaMinutes} min` : 'ETA not supplied'}</p></div><b>AED {quote.amount}</b></div>{quote.message && <p className="quote-message">{quote.message}</p>}<button className="primary" disabled={working === quote.id} onClick={() => choose(quote)}>{working === quote.id ? 'Booking…' : 'Accept quote'}</button></article>)}</div>}
          <button className="danger-link" disabled={working === 'cancel'} onClick={cancel}>{working === 'cancel' ? 'Cancelling…' : 'Cancel request'}</button></div>}
        {request.status === 'booked' && <div className="success-panel"><strong>Booked.</strong><p>You accepted a provider quote. Payment is handled directly with the provider in this V1. Your provider contact details are shown on the homepage booking card.</p></div>}
        {request.status === 'cancelled' && <div className="empty-state"><strong>Request cancelled.</strong></div>}
      </>}
    </section>
  </main>
}

function ProviderAuth({ onDone }: { onDone?: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { mode === 'signin' ? await providerSignIn(email, password) : await providerSignUp(email, password); onDone?.() } catch (err) { setError(err instanceof Error ? err.message : 'Authentication failed.') }
    setBusy(false)
  }
  return <div className="auth-card"><h2>{mode === 'signin' ? 'Provider sign in' : 'Create provider account'}</h2><p>Use email and password. Provider profiles still require Asanib approval before they can quote.</p>{error && <ErrorBox message={error} />}<form onSubmit={submit}><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Password<input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></label><button className="primary" disabled={busy}>{busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button></form><button className="text-button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Need an account? Sign up' : 'Already registered? Sign in'}</button></div>
}

function ProviderOnboarding({ user }: { user: User }) {
  const [businessName, setBusinessName] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [areas, setAreas] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      await saveProviderProfile({ businessName, phone, whatsapp, areas: areas.split(',').map((item) => item.trim()).filter(Boolean), categories, availableNow: false, createdAt: undefined, updatedAt: undefined })
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save provider profile.') }
    setBusy(false)
  }
  return <div className="form-panel"><div className="eyebrow">PROVIDER ONBOARDING</div><h1>Tell us what you actually do.</h1><p>Signed in as {user.email}. Service areas can be neighbourhoods, cities, or emirates separated by commas.</p>{error && <ErrorBox message={error} />}<form className="stack-form" onSubmit={submit}><label>Business name<input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required /></label><div className="two-col"><label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} required /></label><label>WhatsApp<input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} /></label></div><label>Service areas<input value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="Ajman, Al Zahia, Sharjah" required /></label><fieldset><legend>Services</legend><div className="check-grid">{serviceCategories.map((category) => <label key={category}><input type="checkbox" checked={categories.includes(category)} onChange={(e) => setCategories(e.target.checked ? [...categories, category] : categories.filter((item) => item !== category))} /> {category}</label>)}</div></fieldset><button className="primary" disabled={busy || categories.length === 0}>{busy ? 'Saving…' : 'Submit provider profile'}</button></form></div>
}

function QuoteForm({ request, provider }: { request: ServiceRequest; provider: ProviderProfile }) {
  const [amount, setAmount] = useState('')
  const [eta, setEta] = useState('')
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('')
    try { await submitQuote({ requestId: request.id, provider, amount: Number(amount), etaMinutes: eta ? Number(eta) : undefined, message }); setDone(true) } catch (err) { setError(err instanceof Error ? err.message : 'Could not send quote.') }
  }
  if (done) return <div className="success-inline">Quote sent</div>
  return <form className="quote-form" onSubmit={submit}>{error && <ErrorBox message={error} />}<div className="two-col"><label>AED<input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} required /></label><label>ETA minutes<input inputMode="numeric" value={eta} onChange={(e) => setEta(e.target.value.replace(/\D/g, ''))} /></label></div><label>Message<input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What is included?" /></label><button className="primary compact">Send quote</button></form>
}

function ProviderDashboard({ user, profile }: { user: User; profile: ProviderProfile }) {
  const [openRequests, setOpenRequests] = useState<ServiceRequest[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [availabilityBusy, setAvailabilityBusy] = useState(false)
  useEffect(() => {
    const stopQuotes = watchMyProviderQuotes(profile.id, setQuotes)
    const stopBookings = watchProviderBookings(profile.id, setBookings)
    let stopRequests = () => undefined
    if (profile.approved) stopRequests = watchOpenRequests(setOpenRequests)
    return () => { stopQuotes(); stopBookings(); stopRequests() }
  }, [profile.id, profile.approved])
  const matches = matchingRequests(profile, openRequests)
  async function toggleAvailability() { setAvailabilityBusy(true); await setProviderAvailability(user.uid, !profile.availableNow); setAvailabilityBusy(false) }
  return <>
    <section className="provider-summary"><div><div className="eyebrow">PROVIDER DASHBOARD</div><h1>{profile.businessName}</h1><p>{profile.areas.join(' · ')} · {profile.categories.join(' · ')}</p></div><div className="provider-controls"><span className={`approval ${profile.approved ? 'approved' : 'pending'}`}>{profile.approved ? 'Approved' : 'Awaiting approval'}</span><button className={profile.availableNow ? 'availability on' : 'availability'} disabled={availabilityBusy} onClick={toggleAvailability}>{profile.availableNow ? '● Available now' : '○ Not available now'}</button><button className="text-button" onClick={logOut}>Sign out</button></div></section>
    {!profile.approved && <div className="notice">Your profile is saved. An Asanib admin must approve it before customer requests are visible.</div>}
    {profile.approved && <section className="dashboard-section"><div className="section-heading"><h2>Matching open requests</h2><span>{matches.length}</span></div>{matches.length === 0 ? <div className="empty-state"><strong>No matching requests right now.</strong><p>Matching uses your selected service categories and service areas.</p></div> : <div className="provider-request-grid">{matches.map((request) => <article className="provider-request" key={request.id}><div className="demo-head"><span>{request.category}</span><b>{request.urgency.toUpperCase()}</b></div><h3>{request.query}</h3><p>{request.location}{request.budget ? ` · budget up to AED ${request.budget}` : ' · open budget'}</p><QuoteForm request={request} provider={profile} /></article>)}</div>}</section>}
    <section className="dashboard-section"><div className="section-heading"><h2>Your quotes</h2><span>{quotes.length}</span></div><div className="list-stack">{quotes.length === 0 ? <div className="empty-state">No quotes sent yet.</div> : quotes.map((quote) => <div className="list-card" key={quote.id}><div><strong>AED {quote.amount}</strong><p>Request {quote.requestId.slice(0, 7)} · {quote.providerName}</p></div><span className={`status ${quote.status}`}>{quote.status}</span></div>)}</div></section>
    <section className="dashboard-section"><div className="section-heading"><h2>Booked jobs</h2><span>{bookings.length}</span></div><div className="list-stack">{bookings.length === 0 ? <div className="empty-state">No bookings yet.</div> : bookings.map((booking) => <div className="job-card" key={booking.id}><div><strong>Booking {booking.id.slice(0, 7)}</strong><p>AED {booking.amount} · request {booking.requestId.slice(0, 7)}</p></div><select value={booking.status} onChange={(e) => updateBookingStatus(booking.id, e.target.value as Booking['status'])}><option value="booked">Booked</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div>)}</div></section>
  </>
}

function ProviderPortal() {
  const { user, ready } = useCurrentUser()
  const [profile, setProfile] = useState<ProviderProfile | null>(null)
  useEffect(() => { if (!user || user.isAnonymous || !firebaseConfigured) { setProfile(null); return }; return watchProviderProfile(user.uid, setProfile) }, [user])
  return <main className="page"><header className="topbar"><a className="brand" href="/">asanib<span>.</span></a><a className="provider-link" href="/">Customer app</a></header>{!firebaseConfigured ? <ErrorBox message="Firebase must be configured before provider accounts can work." /> : !ready ? <p>Loading…</p> : !user || user.isAnonymous ? <ProviderAuth /> : !profile ? <ProviderOnboarding user={user} /> : <ProviderDashboard user={user} profile={profile} />}</main>
}

function AdminPanel() {
  const { user, ready } = useCurrentUser()
  const [allowed, setAllowed] = useState(false)
  const [checked, setChecked] = useState(false)
  const [providers, setProviders] = useState<ProviderProfile[]>([])
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  useEffect(() => { if (!user || user.isAnonymous || !firebaseConfigured) { setChecked(true); setAllowed(false); return }; return watchAdminAccess(user.uid, (value) => { setAllowed(value); setChecked(true) }) }, [user])
  useEffect(() => { if (!allowed) return; const a = watchAllProviders(setProviders); const b = watchAllRequests(setRequests); return () => { a(); b() } }, [allowed])
  if (!firebaseConfigured) return <main className="page"><ErrorBox message="Firebase is not configured." /></main>
  if (!ready) return <main className="page"><p>Loading…</p></main>
  if (!user || user.isAnonymous) return <main className="page"><header className="topbar"><a className="brand" href="/">asanib<span>.</span></a></header><ProviderAuth /></main>
  if (!checked) return <main className="page"><p>Checking admin access…</p></main>
  if (!allowed) return <main className="page"><header className="topbar"><a className="brand" href="/">asanib<span>.</span></a></header><ErrorBox message="This account is not an Asanib admin. Add its UID as a document ID in the admins collection to bootstrap admin access." /><button className="text-button" onClick={logOut}>Sign out</button></main>
  return <main className="page"><header className="topbar"><a className="brand" href="/">asanib<span>.</span></a><button className="text-button" onClick={logOut}>Sign out</button></header><section className="admin-header"><div className="eyebrow">ASANIB ADMIN</div><h1>Operations</h1><p>Approve providers and inspect live customer demand.</p></section><section className="dashboard-section"><div className="section-heading"><h2>Providers</h2><span>{providers.length}</span></div><div className="list-stack">{providers.map((provider) => <div className="admin-provider" key={provider.id}><div><strong>{provider.businessName}</strong><p>{provider.phone} · {provider.areas.join(', ')} · {provider.categories.join(', ')}</p></div><button className={provider.approved ? 'secondary small' : 'primary small'} onClick={() => setProviderApproved(provider.id, !provider.approved)}>{provider.approved ? 'Revoke approval' : 'Approve'}</button></div>)}</div></section><section className="dashboard-section"><div className="section-heading"><h2>Requests</h2><span>{requests.length}</span></div><div className="list-stack">{requests.map((request) => <div className="list-card" key={request.id}><div><strong>{request.query}</strong><p>{request.location} · {request.category}</p></div><span className={`status ${request.status}`}>{request.status}</span></div>)}</div></section></main>
}

export default function App() {
  const path = window.location.pathname
  const requestMatch = path.match(/^\/request\/([^/]+)/)
  if (requestMatch) return <RequestPage requestId={requestMatch[1]} />
  if (path.startsWith('/provider')) return <ProviderPortal />
  if (path.startsWith('/admin')) return <AdminPanel />
  return <CustomerHome />
}
