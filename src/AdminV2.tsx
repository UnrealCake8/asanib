import { FormEvent, useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { firebaseConfigured } from './lib/firebase'
import { logOut, providerSignIn, watchAuth } from './lib/data'
import { watchAdminAccess, watchAllProviders, watchAllRequests } from './lib/admin'
import { openKybDocument, reviewProvider } from './lib/marketplaceApi'
import type { ProviderProfile, ServiceRequest } from './types'

function AdminSignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { await providerSignIn(email.trim(), password) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not sign in.') }
    setBusy(false)
  }
  return <main className="provider-auth-shell"><a className="brand" href="/">asanib<span>.</span></a><section className="provider-auth-card"><span className="app-kicker">ASANIB ADMIN</span><h1>Operations sign in</h1>{error && <div className="notice error">{error}</div>}<form className="provider-auth-form" onSubmit={submit}><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label><button className="primary" disabled={busy}>{busy ? 'Working…' : 'Sign in'}</button></form></section></main>
}

export default function AdminV2() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [checked, setChecked] = useState(false)
  const [providers, setProviders] = useState<ProviderProfile[]>([])
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [tab, setTab] = useState<'providers' | 'requests'>('providers')
  const [working, setWorking] = useState('')
  const [error, setError] = useState('')

  useEffect(() => watchAuth((next) => { setUser(next); setReady(true) }), [])
  useEffect(() => {
    if (!user || user.isAnonymous || !firebaseConfigured) { setAllowed(false); setChecked(true); return }
    return watchAdminAccess(user.uid, (value) => { setAllowed(value); setChecked(true) })
  }, [user])
  useEffect(() => {
    if (!allowed) return
    const a = watchAllProviders(setProviders)
    const b = watchAllRequests(setRequests)
    return () => { a(); b() }
  }, [allowed])

  async function action(provider: ProviderProfile, operation: 'verify_kyb' | 'reject_kyb' | 'approve_payment_link' | 'reject_payment_link' | 'revoke_provider') {
    const key = `${provider.id}:${operation}`
    setWorking(key); setError('')
    try {
      let note = ''
      if (operation === 'reject_kyb' || operation === 'reject_payment_link' || operation === 'revoke_provider') note = window.prompt('Optional review note for the business:') || ''
      await reviewProvider(provider.id, operation, note)
    } catch (err) { setError(err instanceof Error ? err.message : 'Review action failed.') }
    setWorking('')
  }

  if (!firebaseConfigured) return <main className="provider-loading">Firebase is not configured.</main>
  if (!ready) return <main className="provider-loading">Loading Asanib admin…</main>
  if (!user || user.isAnonymous) return <AdminSignIn />
  if (!checked) return <main className="provider-loading">Checking admin access…</main>
  if (!allowed) return <main className="provider-auth-shell"><a className="brand" href="/">asanib<span>.</span></a><section className="provider-auth-card"><h1>Admin access required</h1><p>This Firebase account is not listed in the Asanib <code>admins</code> collection.</p><button className="secondary" onClick={() => void logOut()}>Sign out</button></section></main>

  const pendingKyb = providers.filter((p) => (p.kybStatus || 'not_started') === 'pending').length
  const pendingLinks = providers.filter((p) => p.paymentLinkStatus === 'pending_review').length

  return <main className="admin-v2-shell"><header className="admin-v2-header"><a className="brand" href="/">asanib<span>.</span></a><div><span>OPERATIONS</span><strong>{pendingKyb} KYB · {pendingLinks} payment links pending</strong></div><button onClick={() => void logOut()}>Sign out</button></header><div className="admin-v2-layout"><aside><button className={tab === 'providers' ? 'active' : ''} onClick={() => setTab('providers')}>Businesses <b>{providers.length}</b></button><button className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}>Requests <b>{requests.length}</b></button></aside><section className="admin-v2-workspace">{error && <div className="notice error">{error}</div>}

    {tab === 'providers' && <><div className="admin-v2-title"><div><span>BUSINESS REVIEW</span><h1>Providers</h1></div><p>Review the business, representative identity and external checkout separately.</p></div><div className="admin-provider-grid">{providers.map((provider) => <article className="admin-provider-card" key={provider.id}><div className="admin-provider-head"><div><strong>{provider.businessName || 'Unnamed business'}</strong><span>{provider.legalBusinessName || 'Legal name not supplied'}</span></div><span className={`status-pill ${provider.kybStatus === 'verified' ? 'accepted' : provider.kybStatus === 'rejected' ? 'cancelled' : 'pending'}`}>{provider.kybStatus === 'verified' ? 'Verified' : provider.kybStatus === 'pending' ? 'KYB pending' : provider.kybStatus === 'rejected' ? 'Rejected' : 'Incomplete'}</span></div><dl><div><dt>Licence</dt><dd>{provider.tradeLicenseNumber || '—'}</dd></div><div><dt>Authority</dt><dd>{provider.licensingAuthority || '—'}</dd></div><div><dt>Expires</dt><dd>{provider.licenseExpiry || '—'}</dd></div><div><dt>Representative</dt><dd>{provider.representativeName || '—'}</dd></div><div><dt>Service areas</dt><dd>{provider.areas?.join(', ') || '—'}</dd></div></dl><div className="admin-action-row">{provider.tradeLicensePath && <button className="secondary small" onClick={() => void openKybDocument(provider.id, 'trade_license')}>Trade licence</button>}{provider.emiratesIdFrontPath && <button className="secondary small" onClick={() => void openKybDocument(provider.id, 'emirates_id_front')}>ID front</button>}{provider.emiratesIdBackPath && <button className="secondary small" onClick={() => void openKybDocument(provider.id, 'emirates_id_back')}>ID back</button>}{provider.kybStatus === 'pending' && <><button className="primary small" disabled={working.startsWith(`${provider.id}:`)} onClick={() => void action(provider, 'verify_kyb')}>Verify business</button><button className="secondary small" disabled={working.startsWith(`${provider.id}:`)} onClick={() => void action(provider, 'reject_kyb')}>Reject</button></>}{provider.kybStatus === 'verified' && <button className="secondary small" disabled={working.startsWith(`${provider.id}:`)} onClick={() => void action(provider, 'revoke_provider')}>Revoke</button>}</div><div className="admin-payment-review"><div><span>EXTERNAL CHECKOUT</span><strong>{provider.checkoutHost || 'Not configured'}</strong><small>{provider.checkoutProvider || provider.checkoutUrl || ''}</small></div>{provider.paymentLinkStatus === 'pending_review' && <div className="admin-action-row"><button className="primary small" onClick={() => void action(provider, 'approve_payment_link')}>Approve link</button><button className="secondary small" onClick={() => void action(provider, 'reject_payment_link')}>Reject</button></div>}{provider.paymentLinkStatus === 'approved' && <span className="status-pill accepted">Approved</span>}{provider.paymentLinkStatus === 'rejected' && <span className="status-pill cancelled">Rejected</span>}</div></article>)}</div></>}

    {tab === 'requests' && <><div className="admin-v2-title"><div><span>LIVE DEMAND</span><h1>Requests</h1></div></div><div className="list-stack">{requests.map((request) => <div className="app-list-card" key={request.id}><div><strong>{request.query}</strong><span>{request.location} · {request.category}</span></div><b className={`status ${request.status}`}>{request.status}</b></div>)}</div></>}
  </section></div></main>
}
