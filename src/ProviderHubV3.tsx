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
import { saveProviderBusiness, uploadKybDocument } from './lib/marketplaceApi'
import type { Booking, KybDocumentType, ProviderProfile, Quote, Review, ServiceRequest } from './types'

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

  return <main className="pv3-auth"><a className="brand" href="/">asanib<span>.</span></a><section><span>ASANIB FOR BUSINESS</span><h1>{mode === 'signin' ? 'Welcome back' : 'Grow with Asanib'}</h1><p>See nearby demand, quote customers, manage jobs and keep your business verification in one place.</p><div className="pv3-auth-tabs"><button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Sign in</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create account</button></div>{error && <div className="notice error">{error}</div>}<form onSubmit={submit}><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Password<input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></label><button className="primary" disabled={busy}>{busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button></form></section></main>
}

function requestOutcome(request: ServiceRequest, providerId: string) {
  const mine = request.acceptedProviderId === providerId
  if (request.status === 'cancelled') return { label: 'Customer cancelled', detail: 'The customer closed this request.', tone: 'cancelled' }
  if (request.status === 'completed' && mine) return { label: 'Completed by you', detail: 'This request was completed by your business.', tone: 'completed' }
  if (request.status === 'completed') return { label: 'Completed elsewhere', detail: 'The request was completed with another business.', tone: 'withdrawn' }
  if (request.status === 'booked' && mine) return { label: 'Booked with you', detail: 'The customer selected your quote.', tone: 'booked' }
  if (request.status === 'booked') return { label: 'Another business chosen', detail: 'The customer selected another business.', tone: 'withdrawn' }
  return { label: 'Open', detail: 'You can still quote this request.', tone: 'pending' }
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
  return <form className="pv3-quote" onSubmit={submit}><label>Price<div className="money-input"><b>AED</b><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div></label><label>ETA minutes<input inputMode="numeric" value={eta} onChange={(e) => setEta(e.target.value.replace(/\D/g, ''))} /></label><label className="full">Message<textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What is included?" /></label>{error && <div className="notice error full">{error}</div>}<button className="primary full" disabled={busy || !Number(amount)}>{busy ? 'Sending…' : 'Send quote'}</button></form>
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
  const [representativeConfirmed, setRepresentativeConfirmed] = useState(Boolean(profile?.representativeConfirmed))
  const [tradeLicensePath, setTradeLicensePath] = useState<string | null>(profile?.tradeLicensePath || null)
  const [emiratesIdFrontPath, setEmiratesIdFrontPath] = useState<string | null>(profile?.emiratesIdFrontPath || null)
  const [emiratesIdBackPath, setEmiratesIdBackPath] = useState<string | null>(profile?.emiratesIdBackPath || null)
  const [checkoutUrl, setCheckoutUrl] = useState(profile?.checkoutUrl || '')
  const [checkoutProvider, setCheckoutProvider] = useState(profile?.checkoutProvider || '')
  const [uploading, setUploading] = useState<KybDocumentType | null>(null)
  const [busy, setBusy] = useState(false)
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
    setEmiratesIdFrontPath(profile.emiratesIdFrontPath || null)
    setEmiratesIdBackPath(profile.emiratesIdBackPath || null)
    setCheckoutUrl(profile.checkoutUrl || '')
    setCheckoutProvider(profile.checkoutProvider || '')
  }, [profile])

  async function upload(file: File | undefined, type: KybDocumentType) {
    if (!file) return
    setUploading(type); setError(''); setMessage('')
    try {
      const path = await uploadKybDocument(file, type)
      if (type === 'trade_license') setTradeLicensePath(path)
      if (type === 'emirates_id_front') setEmiratesIdFrontPath(path)
      if (type === 'emirates_id_back') setEmiratesIdBackPath(path)
      setMessage('Document uploaded securely. Save to submit or refresh your verification.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not upload document.') }
    setUploading(null)
  }

  const verificationItems = [
    ['Business details', Boolean(legalBusinessName && tradeLicenseNumber && licensingAuthority && licenseExpiry)],
    ['Authorised representative', Boolean(representativeName && representativeConfirmed)],
    ['Trade licence', Boolean(tradeLicensePath)],
    ['Emirates ID front', Boolean(emiratesIdFrontPath)],
    ['Emirates ID back', Boolean(emiratesIdBackPath)],
  ] as const
  const completeCount = verificationItems.filter(([, done]) => done).length

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const result = await saveProviderBusiness({
        businessName, phone, whatsapp,
        areas: areas.split(',').map((x) => x.trim()).filter(Boolean),
        categories: selected,
        legalBusinessName, tradeLicenseNumber, licensingAuthority, licenseExpiry,
        representativeName, representativeConfirmed,
        tradeLicensePath, emiratesIdFrontPath, emiratesIdBackPath,
        checkoutUrl, checkoutProvider,
      })
      setMessage(result.kybStatus === 'pending' ? 'Verification submitted. We’ll review the documents and business details.' : 'Business settings saved.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save business settings.') }
    setBusy(false)
  }

  const paymentStatus = profile?.paymentLinkStatus || 'none'
  const kybStatus = profile?.kybStatus || 'not_started'

  return <form className="pv3-settings" onSubmit={save}>
    {message && <div className="account-success">{message}</div>}
    {error && <div className="notice error">{error}</div>}

    <section className="pv3-card pv3-profile-card"><div className="pv3-section-head"><div><span>PUBLIC PROFILE</span><h2>Your business</h2><p>What customers see when you quote.</p></div></div><div className="pv3-fields"><label>Business name<input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required /></label><label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+971…" /></label><label>WhatsApp<input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+971…" /></label><label>Service areas<input value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="Dubai, Sharjah, Ajman" /></label></div><div className="pv3-service-pills">{categories.map((category) => <button type="button" key={category} className={selected.includes(category) ? 'selected' : ''} onClick={() => setSelected((current) => current.includes(category) ? current.filter((x) => x !== category) : [...current, category])}>{selected.includes(category) ? '✓ ' : ''}{category}</button>)}</div></section>

    <section className="pv3-card pv3-kyb"><div className="pv3-kyb-hero"><div><span>BUSINESS VERIFICATION</span><h2>Verify once. Build trust everywhere.</h2><p>We verify the UAE business and the person authorised to manage this Asanib account. Emirates ID images stay private and are only available to authorised Asanib reviewers through short-lived secure links.</p></div><div className={`pv3-kyb-badge ${kybStatus}`}><strong>{kybStatus === 'verified' ? 'Verified' : kybStatus === 'pending' ? 'Under review' : kybStatus === 'rejected' ? 'Needs attention' : `${completeCount}/5 ready`}</strong><span>{kybStatus === 'verified' ? 'Business approved' : 'KYB status'}</span></div></div>

      <div className="pv3-kyb-progress">{verificationItems.map(([label, done]) => <div key={label} className={done ? 'done' : ''}><i>{done ? '✓' : ''}</i><span>{label}</span></div>)}</div>

      <div className="pv3-kyb-grid"><div className="pv3-kyb-step"><div className="pv3-step-number">1</div><div><h3>Business details</h3><p>Match these exactly to the UAE trade licence.</p></div><div className="pv3-fields"><label>Legal business name<input value={legalBusinessName} onChange={(e) => setLegalBusinessName(e.target.value)} placeholder="As shown on licence" /></label><label>Trade licence number<input value={tradeLicenseNumber} onChange={(e) => setTradeLicenseNumber(e.target.value)} /></label><label>Licensing authority<input value={licensingAuthority} onChange={(e) => setLicensingAuthority(e.target.value)} placeholder="DET, SHAMS, Ajman DED…" /></label><label>Licence expiry<input type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} /></label></div></div>

      <div className="pv3-kyb-step"><div className="pv3-step-number">2</div><div><h3>Authorised representative</h3><p>The person responsible for this provider account.</p></div><div className="pv3-fields one"><label>Full name<input value={representativeName} onChange={(e) => setRepresentativeName(e.target.value)} placeholder="As shown on Emirates ID" /></label></div><label className="pv3-confirm"><input type="checkbox" checked={representativeConfirmed} onChange={(e) => setRepresentativeConfirmed(e.target.checked)} /><span>I confirm I am authorised to act for this business and the information supplied is accurate.</span></label></div></div>

      <div className="pv3-documents"><div className="pv3-doc-head"><div><span>DOCUMENTS</span><h3>Upload verification files</h3></div><small>PDF, JPG, PNG or WebP · max 10 MB each</small></div><div className="pv3-doc-grid">
        <label className={tradeLicensePath ? 'uploaded' : ''}><input type="file" accept="application/pdf,image/*" onChange={(e) => void upload(e.target.files?.[0], 'trade_license')} /><b>{tradeLicensePath ? '✓' : '01'}</b><strong>Trade licence</strong><span>{uploading === 'trade_license' ? 'Uploading…' : tradeLicensePath ? 'Uploaded securely · replace' : 'Tap to upload'}</span></label>
        <label className={emiratesIdFrontPath ? 'uploaded' : ''}><input type="file" accept="application/pdf,image/*" onChange={(e) => void upload(e.target.files?.[0], 'emirates_id_front')} /><b>{emiratesIdFrontPath ? '✓' : '02'}</b><strong>Emirates ID · front</strong><span>{uploading === 'emirates_id_front' ? 'Uploading…' : emiratesIdFrontPath ? 'Uploaded securely · replace' : 'Tap to upload'}</span></label>
        <label className={emiratesIdBackPath ? 'uploaded' : ''}><input type="file" accept="application/pdf,image/*" onChange={(e) => void upload(e.target.files?.[0], 'emirates_id_back')} /><b>{emiratesIdBackPath ? '✓' : '03'}</b><strong>Emirates ID · back</strong><span>{uploading === 'emirates_id_back' ? 'Uploading…' : emiratesIdBackPath ? 'Uploaded securely · replace' : 'Tap to upload'}</span></label>
      </div></div>{profile?.kybReviewNote && kybStatus === 'rejected' && <div className="notice error">{profile.kybReviewNote}</div>}</section>

    <section className="pv3-card"><div className="pv3-section-head"><div><span>PAYMENTS</span><h2>External checkout</h2><p>Optional. Add your own secure checkout alongside Asanib Checkout.</p></div><span className={`status-pill ${paymentStatus === 'approved' ? 'accepted' : paymentStatus === 'rejected' ? 'cancelled' : 'pending'}`}>{paymentStatus === 'approved' ? 'Approved' : paymentStatus === 'pending_review' ? 'Review pending' : paymentStatus === 'rejected' ? 'Needs attention' : 'Not set'}</span></div><div className="pv3-fields"><label>Payment provider<input value={checkoutProvider} onChange={(e) => setCheckoutProvider(e.target.value)} placeholder="Ziina, Tap, your website…" /></label><label>HTTPS checkout link<input type="url" value={checkoutUrl} onChange={(e) => setCheckoutUrl(e.target.value)} placeholder="https://…" /></label></div></section>

    <button className="primary pv3-save" disabled={busy || Boolean(uploading) || !businessName.trim() || !phone.trim() || selected.length === 0}>{busy ? 'Saving…' : kybStatus === 'verified' ? 'Save changes' : 'Save & submit verification'}</button>
  </form>
}

export default function ProviderHubV3() {
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
  const recentUpdates = useMemo(() => requests.filter((request) => request.status !== 'open').slice(0, 20), [requests])
  const active = bookings.filter((x) => x.status === 'booked' || x.status === 'in_progress')
  const pendingQuotes = quotes.filter((q) => q.status === 'pending')
  const avg = reviews.length ? reviews.reduce((sum, x) => sum + x.rating, 0) / reviews.length : 0

  if (!ready) return <main className="provider-loading">Loading Asanib…</main>
  if (!user || user.isAnonymous) return <AuthPanel />
  const providerUid = user.uid

  async function availability() {
    if (!profile) return
    setError('')
    try { await setProviderAvailability(providerUid, !profile.availableNow) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update availability.') }
  }

  async function job(booking: Booking, status: Booking['status']) {
    setError('')
    try { await updateBookingStatus(booking.id, status) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update job.') }
  }

  const nav: [Tab, string, string][] = [['home', 'Home', '⌂'], ['requests', 'Requests', '⌕'], ['jobs', 'Jobs', '✓'], ['business', 'Business', '◉']]
  const verificationLabel = profile?.kybStatus === 'verified' ? 'Verified business' : profile?.kybStatus === 'pending' ? 'Verification under review' : 'Finish verification'

  return <main className="pv3-shell"><aside className="pv3-sidebar"><a className="brand" href="/">asanib<span>.</span></a><div className="pv3-business"><div>{profile?.businessName?.[0]?.toUpperCase() || 'B'}</div><span><strong>{profile?.businessName || 'Your business'}</strong><small>{verificationLabel}</small></span></div><nav>{nav.map(([id, label, icon]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><i>{icon}</i>{label}{id === 'requests' && matches.length ? <b>{matches.length}</b> : null}</button>)}</nav><div className="pv3-side-bottom"><a href="/provider/payouts">Payouts</a><a href="/">Customer app</a><button onClick={() => void logOut()}>Sign out</button></div></aside>

    <section className="pv3-workspace"><header className="pv3-header"><div><span>ASANIB FOR BUSINESS</span><h1>{tab === 'home' ? `Hi, ${profile?.businessName || 'there'}` : tab === 'requests' ? 'Requests' : tab === 'jobs' ? 'Jobs' : 'Business'}</h1></div><div className="pv3-header-actions"><a className="pv3-payouts-link" href="/provider/payouts">Payouts</a><button className={`pv3-availability ${profile?.availableNow ? 'online' : ''}`} disabled={!profile?.approved} onClick={() => void availability()}><i />{profile?.availableNow ? 'Available now' : 'Go available'}</button></div></header>

      {profile?.kybStatus !== 'verified' && <button className="pv3-verification-banner" onClick={() => setTab('business')}><div><span>{profile?.kybStatus === 'pending' ? 'UNDER REVIEW' : 'ACTION NEEDED'}</span><strong>{verificationLabel}</strong><p>{profile?.kybStatus === 'pending' ? 'We’re reviewing your documents. You can still edit business details if needed.' : 'Complete KYB to send quotes and take jobs.'}</p></div><b>Open →</b></button>}
      {error && <div className="notice error">{error}</div>}

      {tab === 'home' && <><div className="pv3-stats"><article><span>Open matches</span><strong>{matches.length}</strong><small>Ready to quote</small></article><article><span>Pending quotes</span><strong>{pendingQuotes.length}</strong><small>Awaiting customer</small></article><article><span>Active jobs</span><strong>{active.length}</strong><small>Booked or underway</small></article><article><span>Rating</span><strong>{reviews.length ? avg.toFixed(1) : '—'}</strong><small>{reviews.length} review{reviews.length === 1 ? '' : 's'}</small></article></div><div className="pv3-dashboard"><section className="pv3-card pv3-feature"><div className="pv3-card-title"><div><span>NEW REQUESTS</span><h2>Work that fits</h2></div><button onClick={() => setTab('requests')}>See all</button></div>{matches.slice(0, 4).map((r) => <button className="pv3-request-mini" key={r.id} onClick={() => setTab('requests')}><div><strong>{r.query}</strong><span>{r.location} · {r.urgency === 'now' ? 'Needed now' : r.urgency}</span></div><b>{r.budget ? `≤ AED ${r.budget}` : 'Open budget'}</b></button>)}{!matches.length && <div className="empty-state">No matching requests right now.</div>}</section><section className="pv3-card"><div className="pv3-card-title"><div><span>ACTIVE JOBS</span><h2>Today’s work</h2></div><button onClick={() => setTab('jobs')}>Manage</button></div>{active.slice(0, 4).map((b) => <div className="pv3-request-mini static" key={b.id}><div><strong>{b.status === 'booked' ? 'Ready to start' : 'In progress'}</strong><span>Booking {b.id.slice(0, 8)}</span></div><b>AED {b.amount}</b></div>)}{!active.length && <div className="empty-state">No active jobs.</div>}</section></div>{recentUpdates.length > 0 && <section className="pv3-card pv3-activity"><div className="pv3-card-title"><div><span>RECENT ACTIVITY</span><h2>What happened to requests</h2></div><button onClick={() => setTab('requests')}>History</button></div><div>{recentUpdates.slice(0, 5).map((r) => { const outcome = requestOutcome(r, providerUid); return <article key={r.id}><span className={`status-pill ${outcome.tone}`}>{outcome.label}</span><div><strong>{r.query}</strong><small>{outcome.detail}</small></div></article> })}</div></section>}</>}

      {tab === 'requests' && <div className="pv3-stack"><section className="pv3-card"><div className="pv3-card-title"><div><span>OPEN REQUESTS</span><h2>Relevant work near you</h2></div><small>{matches.length} open</small></div>{matches.map((r) => <article className="pv3-request" key={r.id}><div className="pv3-request-copy"><div><span>{r.category}</span>{r.urgency === 'now' && <span className="urgent">Need it now</span>}</div><h3>{r.query}</h3><p>{r.location}{r.scheduledFor ? ` · ${r.scheduledFor}` : ''}</p></div><div className="pv3-request-actions"><strong>{r.budget ? `Up to AED ${r.budget}` : 'Budget not set'}</strong><button className="primary compact" disabled={!profile?.approved} onClick={() => setQuoting(quoting === r.id ? null : r.id)}>{quoting === r.id ? 'Close' : 'Send quote'}</button></div>{quoting === r.id && profile && <QuoteBox request={r} provider={profile} done={() => setQuoting(null)} />}</article>)}{!matches.length && <div className="empty-state large"><strong>No open requests.</strong><p>New matching demand will appear here.</p></div>}</section><section className="pv3-card"><div className="pv3-card-title"><div><span>REQUEST HISTORY</span><h2>Closed and resolved</h2></div><small>{recentUpdates.length}</small></div><div className="pv3-history">{recentUpdates.map((r) => { const outcome = requestOutcome(r, providerUid); return <article key={r.id}><span className={`status-pill ${outcome.tone}`}>{outcome.label}</span><div><strong>{r.query}</strong><p>{r.location} · {outcome.detail}</p></div><b>{r.budget ? `AED ${r.budget}` : '—'}</b></article> })}{!recentUpdates.length && <div className="empty-state">Nothing closed yet.</div>}</div></section></div>}

      {tab === 'jobs' && <section className="pv3-card"><div className="pv3-card-title"><div><span>JOBS</span><h2>Bookings and progress</h2></div><small>{bookings.length} total</small></div><div className="pv3-jobs">{bookings.map((b) => <article key={b.id}><div><span className={`status-pill ${b.status}`}>{b.status.replace('_', ' ')}</span><h3>Booking {b.id.slice(0, 8)}</h3><p>AED {b.amount}</p></div><div>{b.status === 'booked' && <button className="primary compact" onClick={() => void job(b, 'in_progress')}>Start job</button>}{b.status === 'in_progress' && <button className="primary compact" onClick={() => void job(b, 'completed')}>Complete</button>}{(b.status === 'booked' || b.status === 'in_progress') && <button className="secondary small" onClick={() => void job(b, 'cancelled')}>Cancel</button>}</div></article>)}{!bookings.length && <div className="empty-state large">No bookings yet.</div>}</div></section>}

      {tab === 'business' && <BusinessSettings profile={profile} />}
    </section>

    <nav className="pv3-mobile-nav" aria-label="Provider navigation">{nav.map(([id, label, icon]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><span>{icon}</span>{label}{id === 'requests' && matches.length ? <b>{matches.length}</b> : null}</button>)}</nav>
  </main>
}
