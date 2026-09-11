import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import {
  logOut,
  matchingRequests,
  providerSignIn,
  providerSignUp,
  saveProviderProfile,
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
import type { Booking, ProviderProfile, Quote, Review, ServiceRequest } from './types'

const serviceCategories = ['Home services', 'Send & errands', 'Auto services', 'Beauty', 'Local services']

type Panel = 'overview' | 'requests' | 'quotes' | 'jobs' | 'profile' | 'notifications'

function formatRequestAlert(profile: ProviderProfile, request: ServiceRequest) {
  const timing = request.urgency === 'now' ? 'needed now' : request.urgency === 'today' ? 'needed today' : `scheduled for ${request.scheduledFor || 'later'}`
  return `Hello ${profile.businessName},\n\nYou have a new Asanib request.\n\n${request.query}\nLocation: ${request.location}\n${request.budget ? `Budget: up to AED ${request.budget}\n` : ''}Timing: ${timing}\n\nOpen Asanib to send your quote.`
}

function ProviderAuth() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (mode === 'signin') await providerSignIn(email.trim(), password)
      else await providerSignUp(email.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not continue.')
    }
    setBusy(false)
  }

  return <main className="provider-auth-shell">
    <a className="brand" href="/">asanib<span>.</span></a>
    <section className="provider-auth-card">
      <span className="app-kicker">ASANIB FOR PROVIDERS</span>
      <h1>{mode === 'signin' ? 'Sign in to your business workspace' : 'Create your provider account'}</h1>
      <p>Receive relevant local requests, quote quickly and manage jobs from one place.</p>
      <div className="provider-auth-tabs">
        <button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Sign in</button>
        <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create account</button>
      </div>
      {error && <div className="notice error">{error}</div>}
      <form onSubmit={submit} className="provider-auth-form">
        <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="primary" disabled={busy}>{busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create provider account'}</button>
      </form>
      <p className="legal-mini">By continuing, you agree to the <a href="/terms">Terms & Conditions</a> and acknowledge the <a href="/privacy">Privacy Policy</a>.</p>
    </section>
  </main>
}

function QuoteComposer({ request, profile, onDone }: { request: ServiceRequest; profile: ProviderProfile; onDone: () => void }) {
  const [amount, setAmount] = useState(request.budget ? String(request.budget) : '')
  const [eta, setEta] = useState(request.urgency === 'now' ? '45' : '')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await submitQuote({
        requestId: request.id,
        provider: profile,
        amount: Number(amount),
        etaMinutes: eta ? Number(eta) : undefined,
        message: message.trim(),
      })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send quote.')
    }
    setBusy(false)
  }

  return <form className="quote-composer" onSubmit={submit}>
    <label>Quote amount<div className="money-input"><b>AED</b><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div></label>
    <label>ETA in minutes<input inputMode="numeric" value={eta} onChange={(e) => setEta(e.target.value.replace(/\D/g, ''))} placeholder="Optional" /></label>
    <label className="span-2">Message<textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What is included? Any useful detail for the customer?" rows={3} /></label>
    {error && <div className="notice error span-2">{error}</div>}
    <button className="primary compact span-2" disabled={busy || !Number(amount)}>{busy ? 'Sending…' : 'Send quote'}</button>
  </form>
}

function ProviderProfileForm({ user, profile }: { user: User; profile: ProviderProfile | null }) {
  const [businessName, setBusinessName] = useState(profile?.businessName || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp || '')
  const [categories, setCategories] = useState<string[]>(profile?.categories || [])
  const [areas, setAreas] = useState((profile?.areas || []).join(', '))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!profile) return
    setBusinessName(profile.businessName)
    setPhone(profile.phone)
    setWhatsapp(profile.whatsapp || '')
    setCategories(profile.categories)
    setAreas(profile.areas.join(', '))
  }, [profile])

  function toggleCategory(category: string) {
    setCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category])
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setError('')
    try {
      await saveProviderProfile({
        businessName,
        phone,
        whatsapp,
        categories,
        areas: areas.split(',').map((item) => item.trim()).filter(Boolean),
        availableNow: profile?.availableNow || false,
        createdAt: profile?.createdAt,
        updatedAt: profile?.updatedAt,
      })
      setMessage('Business profile saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.')
    }
    setBusy(false)
  }

  return <form className="provider-profile-form" onSubmit={submit}>
    <div className="section-heading"><div><span>BUSINESS PROFILE</span><h2>How customers see your business</h2></div><small>{user.email}</small></div>
    {message && <div className="account-success">{message}</div>}
    {error && <div className="notice error">{error}</div>}
    <div className="profile-grid">
      <label>Business name<input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Your business name" /></label>
      <label>Phone<input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971…" /></label>
      <label>WhatsApp number<input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+971…" /></label>
      <label>Service areas<input value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="Ajman, Sharjah, Dubai" /></label>
    </div>
    <div className="field-group"><span>Services</span><div className="category-toggle-grid">{serviceCategories.map((category) => <button type="button" className={categories.includes(category) ? 'selected' : ''} onClick={() => toggleCategory(category)} key={category}>{categories.includes(category) ? '✓ ' : ''}{category}</button>)}</div></div>
    <button className="primary compact" disabled={busy || !businessName.trim() || !phone.trim() || !categories.length}>{busy ? 'Saving…' : 'Save business profile'}</button>
  </form>
}

export default function ProviderHub() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<ProviderProfile | null>(null)
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [panel, setPanel] = useState<Panel>('overview')
  const [quotingId, setQuotingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  useEffect(() => watchAuth((next) => { setUser(next); setReady(true) }), [])
  useEffect(() => {
    if (!user || user.isAnonymous) return
    const stops = [
      watchProviderProfile(user.uid, setProfile),
      watchOpenRequests(setRequests),
      watchMyProviderQuotes(user.uid, setQuotes),
      watchProviderBookings(user.uid, setBookings),
      watchProviderReviews(user.uid, setReviews),
    ]
    return () => stops.forEach((stop) => stop())
  }, [user])

  const matching = useMemo(() => profile ? matchingRequests(profile, requests) : [], [profile, requests])
  const activeJobs = bookings.filter((item) => item.status === 'booked' || item.status === 'in_progress')
  const completedJobs = bookings.filter((item) => item.status === 'completed')
  const pendingQuotes = quotes.filter((item) => item.status === 'pending')
  const averageRating = reviews.length ? reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length : 0

  if (!ready) return <main className="provider-loading">Loading Asanib…</main>
  if (!user || user.isAnonymous) return <ProviderAuth />

  async function toggleAvailability() {
    if (!profile) return
    setActionError('')
    try {
      await setProviderAvailability(user!.uid, !profile.availableNow)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update availability.')
    }
  }

  async function setBooking(booking: Booking, status: Booking['status']) {
    setActionError('')
    try {
      await updateBookingStatus(booking.id, status)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update job.')
    }
  }

  const sampleRequest = matching[0]
  const whatsappPreview = profile && sampleRequest ? formatRequestAlert(profile, sampleRequest) : profile ? `Hello ${profile.businessName},\n\nYou have a new Asanib request matching your services. Open Asanib to view the job and send your quote.` : 'Complete your business profile to preview provider alerts.'

  return <main className="provider-app-shell">
    <aside className="provider-sidebar">
      <a className="brand" href="/">asanib<span>.</span></a>
      <div className="provider-business-mini"><div className="business-avatar">{profile?.businessName?.slice(0, 1).toUpperCase() || 'B'}</div><div><strong>{profile?.businessName || 'Your business'}</strong><span>{profile?.approved ? 'Verified provider' : 'Approval pending'}</span></div></div>
      <nav>
        {([
          ['overview', 'Overview'],
          ['requests', `Requests${matching.length ? ` · ${matching.length}` : ''}`],
          ['quotes', 'Quotes'],
          ['jobs', `Jobs${activeJobs.length ? ` · ${activeJobs.length}` : ''}`],
          ['profile', 'Business profile'],
          ['notifications', 'Notifications'],
        ] as [Panel, string][]).map(([id, label]) => <button key={id} className={panel === id ? 'active' : ''} onClick={() => setPanel(id)}>{label}</button>)}
      </nav>
      <div className="provider-sidebar-bottom"><a href="/">Customer app</a><button onClick={() => void logOut()}>Sign out</button></div>
    </aside>

    <section className="provider-workspace">
      <header className="provider-workspace-header">
        <div><span className="app-kicker">PROVIDER WORKSPACE</span><h1>{profile?.businessName || 'Set up your business'}</h1></div>
        <div className="availability-control"><span><i className={profile?.availableNow ? 'online' : ''} />{profile?.availableNow ? 'Available now' : 'Not taking urgent jobs'}</span><button disabled={!profile} onClick={() => void toggleAvailability()}>{profile?.availableNow ? 'Go offline' : 'Go available'}</button></div>
      </header>

      {!profile && <div className="setup-banner"><strong>Finish your business profile to start receiving matched requests.</strong><button onClick={() => setPanel('profile')}>Set up business</button></div>}
      {profile && !profile.approved && <div className="approval-banner"><strong>Your business is awaiting Asanib approval.</strong><span>You can complete your profile now. Quoting becomes available after approval.</span></div>}
      {actionError && <div className="notice error">{actionError}</div>}

      {panel === 'overview' && <>
        <div className="provider-stat-grid">
          <article><span>Matched requests</span><strong>{matching.length}</strong><small>Open opportunities</small></article>
          <article><span>Quotes awaiting decision</span><strong>{pendingQuotes.length}</strong><small>Customer has not chosen yet</small></article>
          <article><span>Active jobs</span><strong>{activeJobs.length}</strong><small>Booked or in progress</small></article>
          <article><span>Rating</span><strong>{reviews.length ? averageRating.toFixed(1) : '—'}</strong><small>{reviews.length} review{reviews.length === 1 ? '' : 's'}</small></article>
        </div>
        <div className="provider-dashboard-grid">
          <section className="provider-card"><div className="card-title"><div><span>NEW REQUESTS</span><h2>Jobs you can respond to</h2></div><button onClick={() => setPanel('requests')}>View all</button></div>{matching.slice(0, 3).map((request) => <div className="request-row" key={request.id}><div><strong>{request.query}</strong><span>{request.location} · {request.urgency === 'now' ? 'Needed now' : request.urgency}</span></div><b>{request.budget ? `≤ AED ${request.budget}` : 'Open budget'}</b></div>)}{!matching.length && <div className="empty-state">No matching open requests right now.</div>}</section>
          <section className="provider-card"><div className="card-title"><div><span>ACTIVE JOBS</span><h2>Work in progress</h2></div><button onClick={() => setPanel('jobs')}>Manage</button></div>{activeJobs.slice(0, 3).map((booking) => <div className="request-row" key={booking.id}><div><strong>{booking.providerName}</strong><span>Booking {booking.id.slice(0, 7)} · {booking.status.replace('_', ' ')}</span></div><b>AED {booking.amount}</b></div>)}{!activeJobs.length && <div className="empty-state">No active jobs yet.</div>}</section>
        </div>
      </>}

      {panel === 'requests' && <section className="provider-card full-card"><div className="section-heading"><div><span>MATCHED REQUESTS</span><h2>Relevant jobs near you</h2></div><small>{matching.length} open</small></div>{matching.map((request) => <article className="provider-request-card" key={request.id}><div className="request-main"><div className="request-badges"><span>{request.category}</span><span className={request.urgency === 'now' ? 'urgent' : ''}>{request.urgency === 'now' ? 'Need it now' : request.urgency}</span></div><h3>{request.query}</h3><p>{request.location}{request.scheduledFor ? ` · ${request.scheduledFor}` : ''}</p></div><div className="request-side"><strong>{request.budget ? `Up to AED ${request.budget}` : 'Budget not set'}</strong><button className="primary compact" disabled={!profile?.approved} onClick={() => setQuotingId(quotingId === request.id ? null : request.id)}>{quotingId === request.id ? 'Close quote' : 'Send quote'}</button></div>{quotingId === request.id && profile && <QuoteComposer request={request} profile={profile} onDone={() => setQuotingId(null)} />}</article>)}{!matching.length && <div className="empty-state large">You are all caught up. New matching jobs will appear here automatically.</div>}</section>}

      {panel === 'quotes' && <section className="provider-card full-card"><div className="section-heading"><div><span>QUOTES</span><h2>Your sent quotes</h2></div><small>{quotes.length} total</small></div><div className="data-list">{quotes.map((quote) => <div className="data-row" key={quote.id}><div><strong>AED {quote.amount}</strong><span>Request {quote.requestId.slice(0, 8)}{quote.etaMinutes ? ` · ETA ${quote.etaMinutes} min` : ''}</span></div><span className={`status-pill ${quote.status}`}>{quote.status}</span></div>)}{!quotes.length && <div className="empty-state large">No quotes sent yet.</div>}</div></section>}

      {panel === 'jobs' && <section className="provider-card full-card"><div className="section-heading"><div><span>JOBS</span><h2>Bookings and job progress</h2></div><small>{bookings.length} total</small></div><div className="job-grid">{bookings.map((booking) => <article className="job-card" key={booking.id}><div><span className={`status-pill ${booking.status}`}>{booking.status.replace('_', ' ')}</span><h3>Booking {booking.id.slice(0, 8)}</h3><p>AED {booking.amount}</p></div><div className="job-actions">{booking.status === 'booked' && <button className="primary compact" onClick={() => void setBooking(booking, 'in_progress')}>Start job</button>}{booking.status === 'in_progress' && <button className="primary compact" onClick={() => void setBooking(booking, 'completed')}>Mark completed</button>}{(booking.status === 'booked' || booking.status === 'in_progress') && <button className="secondary compact" onClick={() => void setBooking(booking, 'cancelled')}>Cancel</button>}</div></article>)}{!bookings.length && <div className="empty-state large">Accepted jobs will appear here.</div>}</div><div className="completed-summary">Completed jobs: <strong>{completedJobs.length}</strong></div></section>}

      {panel === 'profile' && <section className="provider-card full-card"><ProviderProfileForm user={user} profile={profile} /></section>}

      {panel === 'notifications' && <div className="notification-grid">
        <section className="provider-card"><div className="section-heading"><div><span>PUSH ALERTS</span><h2>Browser & PWA notifications</h2></div><span className="status-pill accepted">Available</span></div><p>When you switch “Available now” on, Asanib can request notification permission and alert you when a matching customer request is created.</p><button className="primary compact" disabled={!profile} onClick={() => void toggleAvailability()}>{profile?.availableNow ? 'Notifications active while available' : 'Go available & enable alerts'}</button></section>
        <section className="provider-card"><div className="section-heading"><div><span>WHATSAPP</span><h2>WhatsApp request alerts</h2></div><span className="status-pill pending">Linking planned</span></div><p>We are preparing a linked WhatsApp channel so a provider can connect a business WhatsApp account and receive matched requests in a structured message.</p><div className="whatsapp-number"><span>Saved WhatsApp</span><strong>{profile?.whatsapp || 'Add a WhatsApp number in Business profile'}</strong></div><div className="message-preview"><span>MESSAGE PREVIEW</span><pre>{whatsappPreview}</pre></div><p className="integration-note">The panel is ready for the transport layer, but Asanib does not currently claim that WhatsApp delivery is active. Until the approved WhatsApp integration is connected, browser/PWA push remains the live alert channel.</p></section>
      </div>}

      <footer className="workspace-footer"><span>Asanib is operated by <strong>JS Ventures LLC</strong>.</span><nav><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/cookies">Cookies</a><a href="/refunds">Refunds</a></nav></footer>
    </section>
  </main>
}
