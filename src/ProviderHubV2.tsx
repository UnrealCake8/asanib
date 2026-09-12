import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import {
  logOut,
  matchingRequests,
  providerSignIn,
  providerSignUp,
  setProviderAvailability,
  submitQuote,
  updateBookingStatus,
  watchAuth,
  watchMyProviderQuotes,
  watchOpenRequests,
  watchProviderBookings,
  watchProviderProfile,
  watchProviderReviews,
} from './lib/data'
import { saveProviderBusiness, uploadTradeLicense } from './lib/marketplaceApi'
import type { Booking, ProviderProfile, Quote, Review, ServiceRequest } from './types'

const categories = ['Home services', 'Send & errands', 'Auto services', 'Beauty', 'Local services']
type Tab = 'home' | 'requests' | 'jobs' | 'business'

function AuthPanel() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { mode === 'signin' ? await providerSignIn(email.trim(), password) : await providerSignUp(email.trim(), password) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not continue.') }
    setBusy(false)
  }

  return <main className="provider-auth-shell"><a className="brand" href="/">asanib<span>.</span></a><section className="provider-auth-card"><span className="app-kicker">ASANIB FOR PROVIDERS</span><h1>{mode === 'signin' ? 'Business sign in' : 'Join Asanib'}</h1><p>Receive relevant local requests, send quotes, manage jobs and get your business verified.</p><div className="provider-auth-tabs"><button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Sign in</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create account</button></div>{error && <div className="notice error">{error}</div>}<form className="provider-auth-form" onSubmit={submit}><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Password<input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></label><button className="primary" disabled={busy}>{busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button></form></section></main>
}

function statusCopy(profile: ProviderProfile | null) {
  const status = profile?.kybStatus || 'not_started'
  if (status === 'verified') return { label: 'Verified business', detail: 'Your business can receive matched requests and send quotes.' }
  if (status === 'pending') return { label: 'Verification pending', detail: 'Asanib is reviewing your business details and trade licence.' }
  if (status === 'rejected') return { label: 'Verification needs attention', detail: profile?.kybReviewNote || 'Review your business details and submit again.' }
  return { label: 'Complete business verification', detail: 'Verify your UAE business before sending customer quotes.' }
}

function requestOutcome(request: ServiceRequest, providerId: string) {
  const mine = request.acceptedProviderId === providerId
  if (request.status === 'cancelled') return { label: 'Customer cancelled', detail: 'This request was cancelled by the customer.', tone: 'cancelled' }
  if (request.status === 'completed' && mine) return { label: 'Completed by you', detail: 'This customer request was completed by your business.', tone: 'completed' }
  if (request.status === 'completed') return { label: 'Completed elsewhere', detail: 'The customer completed this request with another business.', tone: 'withdrawn' }
  if (request.status === 'booked' && mine) return { label: 'Booked with you', detail: 'The customer selected your quote. Manage it from Jobs.', tone: 'booked' }
  if (request.status === 'booked') return { label: 'Another business chosen', detail: 'The customer selected another provider for this request.', tone: 'withdrawn' }
  return { label: 'Open', detail: 'You can still send a quote.', tone: 'pending' }
}

function BusinessSettings({ profile }: { profile: ProviderProfile | null }) {
  const [businessName, setBusinessName] = useState(profile?.businessName || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp || '')
  const [areas, setAreas] = useState((profile?.areas || []).join(', '))
  const [selected, setSelected] = useState<string[]>(profile?.categories || [])
  const [legalBusinessName, setLegalBusinessName] = useState(profile?.legalBusinessName || '')
  const [tradeLicenseNumber, setTradeLicenseNumber] = useState(profile?.tradeLicenseNumber || '')
  const [licensingAuthority, setLicensingAuthority] = useState(profile?.licensingAuthority || '')
  const [licenseExpiry, setLicenseExpiry] = useState(profile?.licenseExpiry || '')
  const [representativeName, setRepresentativeName] = useState(profile?.representativeName || '')
  const [representativeConfirmed, setRepresentativeConfirmed] = useState(profile?.representativeConfirmed || false)
  const [tradeLicensePath, setTradeLicensePath] = useState<string | null>(profile?.tradeLicensePath || null)
  const [checkoutUrl, setCheckoutUrl] = useState(profile?.checkoutUrl || '')
  const [checkoutProvider, setCheckoutProvider] = useState(profile?.checkoutProvider || '')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!profile) return
    setBusinessName(profile.businessName || '')
    setPhone(profile.phone || '')
    setWhatsapp(profile.whatsapp || '')
    setAreas((profile.areas || []).join(', '))
    setSelected(profile.categories || [])
    setLegalBusinessName(profile.legalBusinessName || '')
    setTradeLicenseNumber(profile.tradeLicenseNumber || '')
    setLicensingAuthority(profile.licensingAuthority || '')
    setLicenseExpiry(profile.licenseExpiry || '')
    setRepresentativeName(profile.representativeName || '')
    setRepresentativeConfirmed(Boolean(profile.representativeConfirmed))
    setTradeLicensePath(profile.tradeLicensePath || null)
    setCheckoutUrl(profile.checkoutUrl || '')
    setCheckoutProvider(profile.checkoutProvider || '')
  }, [profile])

  async function upload(file?: File) {
    if (!file) return
    setUploading(true); setError(''); setMessage('')
    try {
      const path = await uploadTradeLicense(file)
      setTradeLicensePath(path)
      setMessage('Trade licence uploaded. Save your business details to submit verification.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not upload trade licence.') }
    setUploading(false)
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const result = await saveProviderBusiness({
        businessName, phone, whatsapp,
        areas: areas.split(',').map((x) => x.trim()).filter(Boolean),
        categories: selected,
        legalBusinessName, tradeLicenseNumber, licensingAuthority, licenseExpiry,
        representativeName, representativeConfirmed, tradeLicensePath,
        checkoutUrl, checkoutProvider,
      })
      setMessage(result.kybStatus === 'pending' ? 'Submitted for Asanib verification.' : 'Business settings saved.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save business settings.') }
    setBusy(false)
  }

  const paymentStatus = profile?.paymentLinkStatus || 'none'
  return <form className="provider-settings-stack" onSubmit={save}>
    {message && <div className="account-success">{message}</div>}
    {error && <div className="notice error">{error}</div>}

    <section className="provider-card full-card"><div className="section-heading"><div><span>BUSINESS PROFILE</span><h2>How customers see you</h2></div></div><div className="profile-grid"><label>Business name<input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required /></label><label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+971…" /></label><label>WhatsApp for alerts<input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+971…" /></label><label>Service areas<input value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="Dubai, Sharjah, Ajman" /></label></div><p className="integration-note">You can list a whole emirate or specific neighbourhoods. Asanib now resolves customer locations so a Dubai-wide provider can match requests in Al Barsha, JVC, Marina and other Dubai areas.</p><div className="field-group"><span>Services</span><div className="category-toggle-grid">{categories.map((category) => <button type="button" key={category} className={selected.includes(category) ? 'selected' : ''} onClick={() => setSelected((current) => current.includes(category) ? current.filter((x) => x !== category) : [...current, category])}>{selected.includes(category) ? '✓ ' : ''}{category}</button>)}</div></div></section>

    <section className="provider-card full-card"><div className="section-heading"><div><span>BUSINESS VERIFICATION</span><h2>Verify your UAE business</h2></div><span className={`status-pill ${profile?.kybStatus || 'pending'}`}>{profile?.kybStatus === 'verified' ? 'Verified' : profile?.kybStatus === 'rejected' ? 'Needs attention' : profile?.kybStatus === 'pending' ? 'Under review' : 'Required'}</span></div><p className="integration-note">Asanib checks that the provider is a real business and that the person creating the account is authorised to act for it. We do not ask for passport or Emirates ID at this stage.</p><div className="profile-grid"><label>Legal business name<input value={legalBusinessName} onChange={(e) => setLegalBusinessName(e.target.value)} placeholder="As shown on the trade licence" /></label><label>Trade licence number<input value={tradeLicenseNumber} onChange={(e) => setTradeLicenseNumber(e.target.value)} /></label><label>Licensing authority<input value={licensingAuthority} onChange={(e) => setLicensingAuthority(e.target.value)} placeholder="Dubai DET, SHAMS, Ajman DED…" /></label><label>Licence expiry<input type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} /></label><label>Authorised representative<input value={representativeName} onChange={(e) => setRepresentativeName(e.target.value)} /></label><label className="file-upload-label">Trade licence PDF/image<input type="file" accept="application/pdf,image/*" onChange={(e) => void upload(e.target.files?.[0])} /><span>{uploading ? 'Uploading…' : tradeLicensePath ? '✓ Trade licence uploaded' : 'Choose file'}</span></label></div><label className="verification-confirm"><input type="checkbox" checked={representativeConfirmed} onChange={(e) => setRepresentativeConfirmed(e.target.checked)} /> I confirm I am authorised to act for this business and that these details are accurate.</label>{profile?.kybReviewNote && profile.kybStatus === 'rejected' && <div className="notice error">{profile.kybReviewNote}</div>}</section>

    <section className="provider-card full-card"><div className="section-heading"><div><span>PAYMENTS</span><h2>Your external checkout</h2></div><span className={`status-pill ${paymentStatus === 'approved' ? 'accepted' : paymentStatus === 'rejected' ? 'cancelled' : 'pending'}`}>{paymentStatus === 'approved' ? 'Approved' : paymentStatus === 'pending_review' ? 'Review pending' : paymentStatus === 'rejected' ? 'Needs attention' : 'Not set'}</span></div><p className="integration-note">Paste your own secure checkout link. When a customer accepts a quote, Asanib can send them to this provider checkout. The customer will see the destination before leaving Asanib. Asanib Checkout powered by Ziina is a separate payment option.</p><div className="profile-grid"><label>Payment provider<input value={checkoutProvider} onChange={(e) => setCheckoutProvider(e.target.value)} placeholder="Ziina, Tap, your website…" /></label><label>HTTPS checkout link<input type="url" value={checkoutUrl} onChange={(e) => setCheckoutUrl(e.target.value)} placeholder="https://…" /></label></div>{profile?.paymentLinkReviewNote && paymentStatus === 'rejected' && <div className="notice error">{profile.paymentLinkReviewNote}</div>}</section>

    <button className="primary provider-save-all" disabled={busy || uploading || !businessName.trim() || !phone.trim() || selected.length === 0}>{busy ? 'Saving…' : 'Save business settings'}</button>
  </form>
}

function QuoteBox({ request, provider, done }: { request: ServiceRequest; provider: ProviderProfile; done: () => void }) {
  const [amount, setAmount] = useState(request.budget ? String(request.budget) : '')
  const [eta, setEta] = useState(request.urgency === 'now' ? '45' : '')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { await submitQuote({ requestId: request.id, provider, amount: Number(amount), etaMinutes: eta ? Number(eta) : undefined, message }); done() }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not send quote.') }
    setBusy(false)
  }
  return <form className="quote-composer" onSubmit={submit}><label>Quote<div className="money-input"><b>AED</b><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div></label><label>ETA minutes<input inputMode="numeric" value={eta} onChange={(e) => setEta(e.target.value.replace(/\D/g, ''))} /></label><label className="span-2">Message<textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What is included?" /></label>{error && <div className="notice error span-2">{error}</div>}<button className="primary compact span-2" disabled={busy || !Number(amount)}>{busy ? 'Sending…' : 'Send quote'}</button></form>
}

export default function ProviderHubV2() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<ProviderProfile | null>(null)
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [tab, setTab] = useState<Tab>('home')
  const [quoting, setQuoting] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => watchAuth((next) => { setUser(next); setReady(true) }), [])
  useEffect(() => {
    if (!user || user.isAnonymous) return
    const stops = [watchProviderProfile(user.uid, setProfile), watchOpenRequests(setRequests), watchMyProviderQuotes(user.uid, setQuotes), watchProviderBookings(user.uid, setBookings), watchProviderReviews(user.uid, setReviews)]
    return () => stops.forEach((stop) => stop())
  }, [user])

  const matches = useMemo(() => profile ? matchingRequests(profile, requests) : [], [profile, requests])
  const recentUpdates = useMemo(() => requests.filter((request) => request.status !== 'open').slice(0, 12), [requests])
  const active = bookings.filter((x) => x.status === 'booked' || x.status === 'in_progress')
  const avg = reviews.length ? reviews.reduce((sum, x) => sum + x.rating, 0) / reviews.length : 0
  const verification = statusCopy(profile)

  if (!ready) return <main className="provider-loading">Loading Asanib…</main>
  if (!user || user.isAnonymous) return <AuthPanel />

  async function availability() {
    if (!profile) return
    setError('')
    try { await setProviderAvailability(user!.uid, !profile.availableNow) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update availability.') }
  }

  async function job(booking: Booking, status: Booking['status']) {
    setError('')
    try { await updateBookingStatus(booking.id, status) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update job.') }
  }

  const nav: [Tab, string, string][] = [['home', 'Home', '⌂'], ['requests', 'Requests', '⌕'], ['jobs', 'Jobs', '✓'], ['business', 'Business', '◉']]

  return <main className="provider-app-shell provider-v2"><aside className="provider-sidebar"><a className="brand" href="/">asanib<span>.</span></a><div className="provider-business-mini"><div className="business-avatar">{profile?.businessName?.[0]?.toUpperCase() || 'B'}</div><div><strong>{profile?.businessName || 'Your business'}</strong><span>{verification.label}</span></div></div><nav>{nav.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}{id === 'requests' && matches.length ? ` · ${matches.length}` : ''}</button>)}</nav><div className="provider-sidebar-bottom"><a href="/">Customer app</a><button onClick={() => void logOut()}>Sign out</button></div></aside>

    <section className="provider-workspace"><header className="provider-workspace-header"><div><span className="app-kicker">ASANIB FOR PROVIDERS</span><h1>{profile?.businessName || 'Set up your business'}</h1></div><div className="availability-control"><span><i className={profile?.availableNow ? 'online' : ''} />{profile?.availableNow ? 'Available now' : 'Not taking urgent jobs'}</span><button disabled={!profile?.approved} onClick={() => void availability()}>{profile?.availableNow ? 'Go offline' : 'Go available'}</button></div></header>

      {!profile?.approved && <button type="button" className="verification-banner" onClick={() => setTab('business')}><div><strong>{verification.label}</strong><span>{verification.detail}</span></div><b>Open verification →</b></button>}
      {error && <div className="notice error">{error}</div>}

      {tab === 'home' && <><div className="provider-stat-grid"><article><span>Matched requests</span><strong>{matches.length}</strong><small>Open opportunities</small></article><article><span>Pending quotes</span><strong>{quotes.filter((q) => q.status === 'pending').length}</strong><small>Awaiting customer</small></article><article><span>Active jobs</span><strong>{active.length}</strong><small>Booked or in progress</small></article><article><span>Rating</span><strong>{reviews.length ? avg.toFixed(1) : '—'}</strong><small>{reviews.length} review{reviews.length === 1 ? '' : 's'}</small></article></div><div className="provider-dashboard-grid"><section className="provider-card provider-card-feature"><div className="card-title"><div><span>NEW REQUESTS</span><h2>Jobs that fit</h2></div><button onClick={() => setTab('requests')}>View all</button></div>{matches.slice(0, 4).map((r) => <div className="request-row" key={r.id}><div><strong>{r.query}</strong><span>{r.location} · {r.urgency === 'now' ? 'Needed now' : r.urgency}</span></div><b>{r.budget ? `≤ AED ${r.budget}` : 'Open budget'}</b></div>)}{!matches.length && <div className="empty-state">No matching requests right now.</div>}</section><section className="provider-card"><div className="card-title"><div><span>ACTIVE JOBS</span><h2>Work in progress</h2></div><button onClick={() => setTab('jobs')}>Manage</button></div>{active.slice(0, 4).map((b) => <div className="request-row" key={b.id}><div><strong>{b.providerName}</strong><span>{b.status.replace('_', ' ')}</span></div><b>AED {b.amount}</b></div>)}{!active.length && <div className="empty-state">No active jobs.</div>}</section></div>{recentUpdates.length > 0 && <section className="provider-card provider-activity-card"><div className="card-title"><div><span>REQUEST ACTIVITY</span><h2>What happened to matched work</h2></div><button onClick={() => setTab('requests')}>See history</button></div><div className="provider-activity-strip">{recentUpdates.slice(0, 4).map((request) => { const outcome = requestOutcome(request, user.uid); return <article key={request.id}><span className={`status-pill ${outcome.tone}`}>{outcome.label}</span><strong>{request.query}</strong><small>{outcome.detail}</small></article> })}</div></section>}</>}

      {tab === 'requests' && <div className="provider-request-sections"><section className="provider-card full-card"><div className="section-heading"><div><span>OPEN REQUESTS</span><h2>Relevant work near you</h2></div><small>{matches.length} open</small></div>{matches.map((r) => <article className="provider-request-card" key={r.id}><div className="request-main"><div className="request-badges"><span>{r.category}</span><span className={r.urgency === 'now' ? 'urgent' : ''}>{r.urgency === 'now' ? 'Need it now' : r.urgency}</span></div><h3>{r.query}</h3><p>{r.location}{r.scheduledFor ? ` · ${r.scheduledFor}` : ''}</p></div><div className="request-side"><strong>{r.budget ? `Up to AED ${r.budget}` : 'Budget not set'}</strong><button className="primary compact" disabled={!profile?.approved} onClick={() => setQuoting(quoting === r.id ? null : r.id)}>{quoting === r.id ? 'Close' : 'Send quote'}</button></div>{quoting === r.id && profile && <QuoteBox request={r} provider={profile} done={() => setQuoting(null)} />}</article>)}{!matches.length && <div className="empty-state large"><strong>No open matched requests right now.</strong><p>New requests that match your services and coverage will appear here.</p></div>}</section>

      <section className="provider-card full-card request-history-card"><div className="section-heading"><div><span>RECENT UPDATES</span><h2>Closed and resolved requests</h2></div><small>{recentUpdates.length} recent</small></div><div className="request-history-list">{recentUpdates.map((r) => { const outcome = requestOutcome(r, user.uid); return <article className="request-history-row" key={r.id}><div className="request-history-copy"><span className={`status-pill ${outcome.tone}`}>{outcome.label}</span><strong>{r.query}</strong><p>{r.location} · {outcome.detail}</p></div><div className="request-history-meta"><span>{r.category}</span><b>{r.budget ? `AED ${r.budget}` : 'Open budget'}</b></div></article> })}{!recentUpdates.length && <div className="empty-state">Nothing has closed yet. Cancelled, booked and completed requests will stay visible here instead of disappearing.</div>}</div></section></div>}

      {tab === 'jobs' && <section className="provider-card full-card"><div className="section-heading"><div><span>JOBS</span><h2>Bookings and progress</h2></div><small>{bookings.length} total</small></div><div className="job-grid">{bookings.map((b) => <article className="job-card" key={b.id}><div><span className={`status-pill ${b.status}`}>{b.status.replace('_', ' ')}</span><h3>{b.providerName}</h3><p>AED {b.amount} · booking {b.id.slice(0, 8)}</p></div><div className="job-actions">{b.status === 'booked' && <button className="primary compact" onClick={() => void job(b, 'in_progress')}>Start job</button>}{b.status === 'in_progress' && <button className="primary compact" onClick={() => void job(b, 'completed')}>Complete</button>}{(b.status === 'booked' || b.status === 'in_progress') && <button className="secondary small" onClick={() => void job(b, 'cancelled')}>Cancel</button>}</div></article>)}{!bookings.length && <div className="empty-state large">No bookings yet.</div>}</div></section>}

      {tab === 'business' && <BusinessSettings profile={profile} />}
    </section>

    <nav className="provider-mobile-nav" aria-label="Provider navigation">{nav.map(([id, label, icon]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><span>{icon}</span>{label}{id === 'requests' && matches.length ? <b>{matches.length}</b> : null}</button>)}</nav>
  </main>
}
