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

const categories = ['Home services', 'Send & errands', 'Auto services', 'Beauty', 'Local services']
type Tab = 'overview' | 'requests' | 'quotes' | 'jobs' | 'profile' | 'notifications'

function requestMessage(profile: ProviderProfile, request?: ServiceRequest) {
  if (!request) return `Hello ${profile.businessName},\n\nYou have a new Asanib request matching your services.\n\nOpen Asanib to view the request and send your quote.`
  const timing = request.urgency === 'now' ? 'Needed now' : request.urgency === 'today' ? 'Needed today' : `Scheduled: ${request.scheduledFor || 'Later'}`
  return `Hello ${profile.businessName},\n\nYou have a new Asanib request.\n\n${request.query}\nLocation: ${request.location}\n${request.budget ? `Budget: up to AED ${request.budget}\n` : ''}${timing}\n\nOpen Asanib to view the request and send your quote.`
}

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
  return <main className="provider-auth-shell"><a className="brand" href="/">asanib<span>.</span></a><section className="provider-auth-card"><span className="app-kicker">ASANIB FOR PROVIDERS</span><h1>{mode === 'signin' ? 'Business sign in' : 'Join as a provider'}</h1><p>Receive matched local requests, send quotes and manage jobs from your Asanib workspace.</p><div className="provider-auth-tabs"><button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Sign in</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create account</button></div>{error && <div className="notice error">{error}</div>}<form className="provider-auth-form" onSubmit={submit}><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Password<input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></label><button className="primary" disabled={busy}>{busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button></form><p className="legal-mini">By continuing, you agree to the <a href="/terms">Terms & Conditions</a> and acknowledge the <a href="/privacy">Privacy Policy</a>.</p></section></main>
}

function ProfileForm({ profile }: { profile: ProviderProfile | null }) {
  const [businessName, setBusinessName] = useState(profile?.businessName || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp || '')
  const [areas, setAreas] = useState((profile?.areas || []).join(', '))
  const [selected, setSelected] = useState<string[]>(profile?.categories || [])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { if (profile) { setBusinessName(profile.businessName); setPhone(profile.phone); setWhatsapp(profile.whatsapp || ''); setAreas(profile.areas.join(', ')); setSelected(profile.categories) } }, [profile])
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      await saveProviderProfile({ businessName, phone, whatsapp, areas: areas.split(',').map((x) => x.trim()).filter(Boolean), categories: selected, availableNow: profile?.availableNow || false, createdAt: profile?.createdAt, updatedAt: profile?.updatedAt })
      setMessage('Business profile saved.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save profile.') }
    setBusy(false)
  }
  return <form className="provider-card full-card provider-profile-form" onSubmit={save}><div className="section-heading"><div><span>BUSINESS PROFILE</span><h2>Business details and matching</h2></div></div>{message && <div className="account-success">{message}</div>}{error && <div className="notice error">{error}</div>}<div className="profile-grid"><label>Business name<input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required /></label><label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+971…" /></label><label>WhatsApp for Asanib alerts<input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+971…" /></label><label>Service areas<input value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="Ajman, Sharjah, Dubai" /></label></div><div className="field-group"><span>Services</span><div className="category-toggle-grid">{categories.map((category) => <button type="button" key={category} className={selected.includes(category) ? 'selected' : ''} onClick={() => setSelected((current) => current.includes(category) ? current.filter((x) => x !== category) : [...current, category])}>{selected.includes(category) ? '✓ ' : ''}{category}</button>)}</div></div><button className="primary compact" disabled={busy || !businessName.trim() || !phone.trim() || selected.length === 0}>{busy ? 'Saving…' : 'Save profile'}</button></form>
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

export default function ProviderHub() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<ProviderProfile | null>(null)
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [tab, setTab] = useState<Tab>('overview')
  const [quoting, setQuoting] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => watchAuth((next) => { setUser(next); setReady(true) }), [])
  useEffect(() => {
    if (!user || user.isAnonymous) return
    const stops = [watchProviderProfile(user.uid, setProfile), watchOpenRequests(setRequests), watchMyProviderQuotes(user.uid, setQuotes), watchProviderBookings(user.uid, setBookings), watchProviderReviews(user.uid, setReviews)]
    return () => stops.forEach((stop) => stop())
  }, [user])

  const matches = useMemo(() => profile ? matchingRequests(profile, requests) : [], [profile, requests])
  const active = bookings.filter((x) => x.status === 'booked' || x.status === 'in_progress')
  const avg = reviews.length ? reviews.reduce((sum, x) => sum + x.rating, 0) / reviews.length : 0

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

  return <main className="provider-app-shell"><aside className="provider-sidebar"><a className="brand" href="/">asanib<span>.</span></a><div className="provider-business-mini"><div className="business-avatar">{profile?.businessName?.[0]?.toUpperCase() || 'B'}</div><div><strong>{profile?.businessName || 'Your business'}</strong><span>{profile?.approved ? 'Approved provider' : 'Approval pending'}</span></div></div><nav>{([['overview','Overview'],['requests',`Requests${matches.length ? ` · ${matches.length}` : ''}`],['quotes','Quotes'],['jobs',`Jobs${active.length ? ` · ${active.length}` : ''}`],['profile','Business profile'],['notifications','Notifications']] as [Tab,string][]).map(([id,label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav><div className="provider-sidebar-bottom"><a href="/">Customer app</a><button onClick={() => void logOut()}>Sign out</button></div></aside><section className="provider-workspace"><header className="provider-workspace-header"><div><span className="app-kicker">PROVIDER WORKSPACE</span><h1>{profile?.businessName || 'Set up your business'}</h1></div><div className="availability-control"><span><i className={profile?.availableNow ? 'online' : ''} />{profile?.availableNow ? 'Available now' : 'Not taking urgent jobs'}</span><button disabled={!profile} onClick={() => void availability()}>{profile?.availableNow ? 'Go offline' : 'Go available'}</button></div></header>{!profile && <div className="setup-banner"><strong>Finish your business profile to receive matched requests.</strong><button onClick={() => setTab('profile')}>Set up business</button></div>}{profile && !profile.approved && <div className="approval-banner"><strong>Awaiting Asanib approval.</strong><span>You can finish your setup now. Quoting unlocks after approval.</span></div>}{error && <div className="notice error">{error}</div>}

  {tab === 'overview' && <><div className="provider-stat-grid"><article><span>Matched requests</span><strong>{matches.length}</strong><small>Open opportunities</small></article><article><span>Pending quotes</span><strong>{quotes.filter((q) => q.status === 'pending').length}</strong><small>Awaiting customer</small></article><article><span>Active jobs</span><strong>{active.length}</strong><small>Booked or in progress</small></article><article><span>Rating</span><strong>{reviews.length ? avg.toFixed(1) : '—'}</strong><small>{reviews.length} review{reviews.length === 1 ? '' : 's'}</small></article></div><div className="provider-dashboard-grid"><section className="provider-card"><div className="card-title"><div><span>NEW REQUESTS</span><h2>Jobs you can respond to</h2></div><button onClick={() => setTab('requests')}>View all</button></div>{matches.slice(0,4).map((r) => <div className="request-row" key={r.id}><div><strong>{r.query}</strong><span>{r.location} · {r.urgency === 'now' ? 'Needed now' : r.urgency}</span></div><b>{r.budget ? `≤ AED ${r.budget}` : 'Open budget'}</b></div>)}{!matches.length && <div className="empty-state">No matching requests right now.</div>}</section><section className="provider-card"><div className="card-title"><div><span>ACTIVE JOBS</span><h2>Work in progress</h2></div><button onClick={() => setTab('jobs')}>Manage</button></div>{active.slice(0,4).map((b) => <div className="request-row" key={b.id}><div><strong>Booking {b.id.slice(0,8)}</strong><span>{b.status.replace('_',' ')}</span></div><b>AED {b.amount}</b></div>)}{!active.length && <div className="empty-state">No active jobs.</div>}</section></div></>}

  {tab === 'requests' && <section className="provider-card full-card"><div className="section-heading"><div><span>MATCHED REQUESTS</span><h2>Relevant work near you</h2></div><small>{matches.length} open</small></div>{matches.map((r) => <article className="provider-request-card" key={r.id}><div className="request-main"><div className="request-badges"><span>{r.category}</span><span className={r.urgency === 'now' ? 'urgent' : ''}>{r.urgency === 'now' ? 'Need it now' : r.urgency}</span></div><h3>{r.query}</h3><p>{r.location}{r.scheduledFor ? ` · ${r.scheduledFor}` : ''}</p></div><div className="request-side"><strong>{r.budget ? `Up to AED ${r.budget}` : 'Budget not set'}</strong><button className="primary compact" disabled={!profile?.approved} onClick={() => setQuoting(quoting === r.id ? null : r.id)}>{quoting === r.id ? 'Close' : 'Send quote'}</button></div>{quoting === r.id && profile && <QuoteBox request={r} provider={profile} done={() => setQuoting(null)} />}</article>)}{!matches.length && <div className="empty-state large">No open matched requests right now.</div>}</section>}

  {tab === 'quotes' && <section className="provider-card full-card"><div className="section-heading"><div><span>QUOTES</span><h2>Your sent quotes</h2></div><small>{quotes.length} total</small></div><div className="data-list">{quotes.map((q) => <div className="data-row" key={q.id}><div><strong>AED {q.amount}</strong><span>Request {q.requestId.slice(0,8)}{q.etaMinutes ? ` · ETA ${q.etaMinutes} min` : ''}</span></div><span className={`status-pill ${q.status}`}>{q.status}</span></div>)}{!quotes.length && <div className="empty-state large">No quotes yet.</div>}</div></section>}

  {tab === 'jobs' && <section className="provider-card full-card"><div className="section-heading"><div><span>JOBS</span><h2>Bookings and progress</h2></div><small>{bookings.length} total</small></div><div className="job-grid">{bookings.map((b) => <article className="job-card" key={b.id}><div><span className={`status-pill ${b.status}`}>{b.status.replace('_',' ')}</span><h3>Booking {b.id.slice(0,8)}</h3><p>AED {b.amount}</p></div><div className="job-actions">{b.status === 'booked' && <button className="primary compact" onClick={() => void job(b,'in_progress')}>Start job</button>}{b.status === 'in_progress' && <button className="primary compact" onClick={() => void job(b,'completed')}>Mark completed</button>}{(b.status === 'booked' || b.status === 'in_progress') && <button className="secondary compact" onClick={() => void job(b,'cancelled')}>Cancel</button>}</div></article>)}{!bookings.length && <div className="empty-state large">Accepted jobs will appear here.</div>}</div></section>}

  {tab === 'profile' && <ProfileForm profile={profile} />}

  {tab === 'notifications' && <div className="notification-grid"><section className="provider-card"><div className="section-heading"><div><span>PUSH ALERTS</span><h2>Browser & PWA alerts</h2></div><span className="status-pill accepted">Live</span></div><p>Asanib can notify you in the browser/PWA when a matching request is created. “Available now” also controls whether urgent requests are matched to you.</p><button className="primary compact" disabled={!profile} onClick={() => void availability()}>{profile?.availableNow ? 'Currently available' : 'Go available'}</button></section><section className="provider-card"><div className="section-heading"><div><span>WHATSAPP ALERTS</span><h2>Messages sent by Asanib</h2></div><span className="status-pill pending">Coming next</span></div><p>You do not link a WhatsApp account. Asanib will operate one central WhatsApp connection and send matching request alerts to the WhatsApp number saved in your business profile.</p><div className="whatsapp-number"><span>Your alert number</span><strong>{profile?.whatsapp || 'Add a WhatsApp number in Business profile'}</strong></div>{profile && <div className="message-preview"><span>MESSAGE PREVIEW</span><pre>{requestMessage(profile, matches[0])}</pre></div>}<p className="integration-note">WhatsApp delivery is not marked active until the Asanib-operated sender session is connected. Browser/PWA push is the live notification channel today.</p></section></div>}

  <footer className="workspace-footer"><span>Asanib is operated by <strong>JS Ventures LLC</strong>.</span><nav><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/cookies">Cookies</a><a href="/refunds">Refunds</a></nav></footer></section></main>
}
