import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import { firebaseConfigured } from './lib/firebase'
import { logOut, providerSignIn, watchAuth } from './lib/data'
import { watchAdminAccess, watchAllRequests, watchExternalDispatches, watchExternalProviders } from './lib/admin'
import { prepareExternalLead, saveExternalProvider } from './lib/marketplaceApi'
import type { ExternalLeadDispatch, ExternalProvider, ServiceRequest } from './types'

function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { await providerSignIn(email.trim(), password) } catch (err) { setError(err instanceof Error ? err.message : 'Could not sign in.') }
    setBusy(false)
  }
  return <main className="provider-auth-shell"><a className="brand" href="/">asanib<span>.</span></a><section className="provider-auth-card"><span className="app-kicker">ASANIB OPERATIONS</span><h1>External matching</h1>{error && <div className="notice error">{error}</div>}<form className="provider-auth-form" onSubmit={submit}><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label><button className="primary" disabled={busy}>{busy ? 'Working…' : 'Sign in'}</button></form></section></main>
}

export default function ExternalOps() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [checked, setChecked] = useState(false)
  const [providers, setProviders] = useState<ExternalProvider[]>([])
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [dispatches, setDispatches] = useState<ExternalLeadDispatch[]>([])
  const [businessName, setBusinessName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [category, setCategory] = useState('Home services')
  const [areas, setAreas] = useState('Ajman')
  const [sourceUrl, setSourceUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedRequest, setSelectedRequest] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => watchAuth((next) => { setUser(next); setReady(true) }), [])
  useEffect(() => {
    if (!user || user.isAnonymous || !firebaseConfigured) { setAllowed(false); setChecked(true); return }
    return watchAdminAccess(user.uid, (value) => { setAllowed(value); setChecked(true) })
  }, [user])
  useEffect(() => {
    if (!allowed) return
    const stops = [watchAllRequests(setRequests), watchExternalProviders(setProviders), watchExternalDispatches(setDispatches)]
    return () => stops.forEach((stop) => stop())
  }, [allowed])

  const openRequests = useMemo(() => requests.filter((request) => request.status === 'open'), [requests])
  useEffect(() => {
    if (!selectedRequest && openRequests.length) setSelectedRequest(openRequests[0].id)
  }, [openRequests, selectedRequest])

  async function addProvider(event: FormEvent) {
    event.preventDefault(); setBusy('add'); setError(''); setNotice('')
    try {
      await saveExternalProvider({ businessName, whatsapp, categories: category.split(',').map((v) => v.trim()).filter(Boolean), areas: areas.split(',').map((v) => v.trim()).filter(Boolean), sourceUrl, notes })
      setBusinessName(''); setWhatsapp(''); setSourceUrl(''); setNotes('')
      setNotice('External business added.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not add business.') }
    setBusy('')
  }

  async function prepare(provider: ExternalProvider) {
    if (!selectedRequest) { setError('Choose a customer request first.'); return }
    setBusy(provider.id); setError(''); setNotice('')
    try {
      const result = await prepareExternalLead(selectedRequest, provider.id)
      const opened = window.open(result.whatsappUrl, '_blank', 'noopener,noreferrer')
      if (!opened) await navigator.clipboard.writeText(result.message)
      setNotice(opened ? `WhatsApp opened for ${provider.businessName}. Send the prepared message.` : `Message copied for ${provider.businessName}.`)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not prepare lead.') }
    setBusy('')
  }

  if (!firebaseConfigured) return <main className="provider-loading">Firebase is not configured.</main>
  if (!ready) return <main className="provider-loading">Loading Asanib operations…</main>
  if (!user || user.isAnonymous) return <SignIn />
  if (!checked) return <main className="provider-loading">Checking admin access…</main>
  if (!allowed) return <main className="provider-auth-shell"><section className="provider-auth-card"><h1>Admin access required</h1><a href="/admin">Back to admin</a></section></main>

  return <main className="admin-v2-shell"><header className="admin-v2-header"><a className="brand" href="/">asanib<span>.</span></a><div><span>EXTERNAL MATCHING</span><strong>{openRequests.length} open requests · {providers.length} businesses</strong></div><div className="admin-action-row"><a className="secondary small" href="/admin">Main admin</a><button onClick={() => void logOut()}>Sign out</button></div></header><div className="admin-v2-layout"><aside><a href="/admin">Businesses & requests</a><a className="active" href="/admin/external">External matching</a></aside><section className="admin-v2-workspace">{error && <div className="notice error">{error}</div>}{notice && <div className="success-panel"><strong>{notice}</strong></div>}

    <div className="admin-v2-title"><div><span>LIVE CONCIERGE</span><h1>Match a request</h1></div><p>Choose an open request, then open a prepared WhatsApp introduction to a local business. If they reply YES, the gateway can send the customer details automatically.</p></div>

    <section className="admin-provider-card"><label><strong>Customer request</strong><select value={selectedRequest} onChange={(e) => setSelectedRequest(e.target.value)}>{openRequests.map((request) => <option value={request.id} key={request.id}>{request.location} · {request.query.slice(0, 90)}</option>)}</select></label>{selectedRequest && (() => { const request = openRequests.find((item) => item.id === selectedRequest); return request ? <dl><div><dt>Request</dt><dd>{request.query}</dd></div><div><dt>Area</dt><dd>{request.location}</dd></div><div><dt>Budget</dt><dd>{request.budget ? `AED ${request.budget}` : 'Open'}</dd></div><div><dt>Contact consent</dt><dd>{request.shareContactConsent ? 'Yes' : 'No'}</dd></div></dl> : null })()}</section>

    <div className="admin-v2-title"><div><span>EXTERNAL DIRECTORY</span><h1>Local businesses</h1></div><p>These businesses do not need Asanib accounts. A YES reply opts them in to this lead and future Asanib lead messages until they reply STOP.</p></div>
    <div className="admin-provider-grid">{providers.map((provider) => { const latest = dispatches.find((item) => item.providerId === provider.id); return <article className="admin-provider-card" key={provider.id}><div className="admin-provider-head"><div><strong>{provider.businessName}</strong><span>+{provider.whatsapp}</span></div><span className={`status-pill ${provider.leadOptIn === true ? 'accepted' : provider.leadOptIn === false ? 'cancelled' : 'pending'}`}>{provider.leadOptIn === true ? 'Opted in' : provider.leadOptIn === false ? 'Opted out' : 'New'}</span></div><dl><div><dt>Services</dt><dd>{provider.categories.join(', ')}</dd></div><div><dt>Areas</dt><dd>{provider.areas.join(', ')}</dd></div><div><dt>Last lead</dt><dd>{latest ? latest.status.replaceAll('_', ' ') : 'None yet'}</dd></div><div><dt>Last reply</dt><dd>{provider.lastWhatsappMessage || '—'}</dd></div></dl><div className="admin-action-row"><button className="primary small" disabled={!selectedRequest || busy === provider.id || provider.leadOptIn === false} onClick={() => void prepare(provider)}>{busy === provider.id ? 'Preparing…' : 'Prepare WhatsApp lead'}</button>{provider.sourceUrl && <a className="secondary small" href={provider.sourceUrl} target="_blank" rel="noreferrer">Source</a>}</div></article> })}{!providers.length && <div className="empty-state large">Add your first external business below.</div>}</div>

    <div className="admin-v2-title"><div><span>ADD BUSINESS</span><h1>External provider</h1></div></div><form className="provider-auth-form admin-provider-card" onSubmit={addProvider}><label>Business name<input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required /></label><label>WhatsApp number<input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="9715XXXXXXXX" required /></label><label>Service categories<input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Home services, Local services" required /></label><label>Service areas<input value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="Ajman, Sharjah" required /></label><label>Public source URL<input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="Optional" /></label><label>Internal notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></label><button className="primary" disabled={busy === 'add'}>{busy === 'add' ? 'Adding…' : 'Add external business'}</button></form>

    <div className="admin-v2-title"><div><span>RECENT LEADS</span><h1>Reply activity</h1></div></div><div className="list-stack">{dispatches.slice(0, 25).map((dispatch) => <div className="app-list-card" key={dispatch.id}><div><strong>{dispatch.providerName}</strong><span>{requests.find((request) => request.id === dispatch.requestId)?.query || dispatch.requestId}</span></div><b className={`status ${dispatch.status}`}>{dispatch.status.replaceAll('_', ' ')}</b></div>)}{!dispatches.length && <div className="empty-state">No external lead activity yet.</div>}</div>
  </section></div></main>
}
