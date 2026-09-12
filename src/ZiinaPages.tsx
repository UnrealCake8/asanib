import { useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { watchAuth, watchProviderProfile } from './lib/data'
import { getAsanibCheckoutStatus, startAsanibCheckout, startZiinaConnect } from './lib/marketplaceApi'
import type { ProviderProfile } from './types'

function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => watchAuth((next) => { setUser(next); setReady(true) }), [])
  return { user, ready }
}

export function ZiinaProviderConnect() {
  const { user, ready } = useUser()
  const [profile, setProfile] = useState<ProviderProfile | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(() => new URLSearchParams(window.location.search).get('error') || '')
  const connected = new URLSearchParams(window.location.search).get('connected') === '1'
  const webhook = new URLSearchParams(window.location.search).get('webhook') === '1'

  useEffect(() => {
    if (!user || user.isAnonymous) return
    return watchProviderProfile(user.uid, setProfile)
  }, [user])

  async function connect() {
    setBusy(true); setError('')
    try {
      const { authorizationUrl } = await startZiinaConnect()
      window.location.assign(authorizationUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Ziina Connect.')
      setBusy(false)
    }
  }

  if (!ready) return <main className="ziina-page"><div className="ziina-card">Loading…</div></main>
  if (!user || user.isAnonymous) return <main className="ziina-page"><div className="ziina-card"><a className="brand" href="/">asanib<span>.</span></a><h1>Provider sign-in required</h1><p>Sign in to your provider account first.</p><a className="primary ziina-link-button" href="/provider">Provider sign in</a></div></main>

  const isConnected = Boolean(profile?.ziinaConnected)
  return <main className="ziina-page"><section className="ziina-card"><div className="ziina-card-head"><a className="brand" href="/">asanib<span>.</span></a><a href="/provider">← Provider dashboard</a></div><span className="eyebrow">ASANIB CHECKOUT</span><h1>Connect Ziina Business</h1><p>Asanib Checkout uses Ziina’s secure embedded checkout. Customer payments go directly to the connected provider’s Ziina Business wallet; Asanib does not hold the service payment.</p>
    {error && <div className="notice error">{error}</div>}
    {connected && <div className="account-success">Ziina connected successfully.{!webhook ? ' Payment webhooks still need to be configured.' : ''}</div>}
    <div className="ziina-status-grid"><div><span>Asanib verification</span><strong>{profile?.kybStatus === 'verified' ? 'Verified' : 'Required first'}</strong></div><div><span>Ziina</span><strong>{isConnected ? 'Connected' : 'Not connected'}</strong></div><div><span>Ziina account</span><strong>{profile?.ziinaDisplayName || profile?.ziinaZiiname || '—'}</strong></div></div>
    {!isConnected ? <button className="primary" disabled={busy || profile?.kybStatus !== 'verified'} onClick={() => void connect()}>{busy ? 'Opening Ziina…' : 'Connect Ziina Business'}</button> : <div className="success-panel"><strong>Asanib Checkout is ready for this provider.</strong><p>When a customer accepts one of your quotes, Asanib can open Ziina checkout inside the app.</p></div>}
    {profile?.kybStatus !== 'verified' && <p className="integration-note">Complete Asanib business verification before connecting payments.</p>}
    <p className="integration-note">Ziina may ask you to sign in and grant Asanib permission to create payment intents on your behalf. Your Ziina password is never shared with Asanib.</p>
  </section></main>
}

export function ZiinaCheckoutPage({ bookingId }: { bookingId: string }) {
  const { user, ready } = useUser()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [embeddedUrl, setEmbeddedUrl] = useState('')
  const [providerName, setProviderName] = useState('Provider')
  const [amountFils, setAmountFils] = useState(0)
  const [status, setStatus] = useState('not_started')
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  async function begin() {
    setBusy(true); setError('')
    try {
      const result = await startAsanibCheckout(bookingId)
      setEmbeddedUrl(`${result.embeddedUrl}${result.embeddedUrl.includes('?') ? '&' : '?'}version=v1`)
      setProviderName(result.providerName || 'Provider')
      setAmountFils(result.amountFils || 0)
      setStatus(result.status || 'requires_payment_instrument')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Asanib Checkout.')
    }
    setBusy(false)
  }

  useEffect(() => {
    if (ready && user && !user.isAnonymous && !embeddedUrl && !busy && status === 'not_started') void begin()
  }, [ready, user])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== 'https://pay.ziina.com') return
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return
      const payload = event.data || {}
      if (payload.type !== 'ZIINA_PAYMENT_STATUS_CHANGE') return
      const next = String(payload.data?.status || '').toLowerCase()
      if (next === 'completed') setStatus('checking')
      else if (next === 'failed' || next === 'canceled') setStatus(next)
      if (next === 'completed') {
        void getAsanibCheckoutStatus(bookingId).then((result) => setStatus(result.status)).catch(() => setStatus('checking'))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [bookingId])

  useEffect(() => {
    if (status !== 'checking' && status !== 'pending' && status !== 'requires_user_action') return
    const timer = window.setInterval(() => {
      void getAsanibCheckoutStatus(bookingId).then((result) => {
        setStatus(result.status)
        if (result.status === 'paid' || result.status === 'failed' || result.status === 'canceled') window.clearInterval(timer)
      }).catch(() => undefined)
    }, 2500)
    return () => window.clearInterval(timer)
  }, [bookingId, status])

  if (!ready) return <main className="ziina-page"><div className="ziina-card">Loading…</div></main>
  if (!user) return <main className="ziina-page"><div className="ziina-card"><h1>Sign in required</h1><p>Open this booking from the same Asanib customer account that created it.</p><a className="primary ziina-link-button" href="/">Go to Asanib</a></div></main>

  if (status === 'paid') return <main className="ziina-page"><section className="ziina-card checkout-complete"><span className="checkout-success-mark">✓</span><span className="eyebrow">PAYMENT CONFIRMED</span><h1>Paid securely with Ziina</h1><p>AED {(amountFils / 100).toFixed(2)} was paid to {providerName}. Asanib has confirmed the payment with Ziina.</p><a className="primary ziina-link-button" href="/">Back to bookings</a></section></main>

  return <main className="ziina-page"><section className="ziina-card checkout-shell"><div className="ziina-card-head"><a className="brand" href="/">asanib<span>.</span></a><a href="/">Close</a></div><span className="eyebrow">ASANIB CHECKOUT · POWERED BY ZIINA</span><h1>Pay {providerName}</h1>{amountFils > 0 && <p className="checkout-amount">AED {(amountFils / 100).toFixed(2)}</p>}{error && <div className="notice error">{error}</div>}{(status === 'failed' || status === 'canceled') && <div className="notice error">Payment {status}. You can try again.</div>}
    {embeddedUrl ? <iframe ref={iframeRef} id="ziina-checkout" className="ziina-checkout-frame" src={embeddedUrl} title="Ziina secure checkout" allow="payment" /> : <div className="checkout-loading">{busy ? 'Preparing secure checkout…' : <button className="primary" onClick={() => void begin()}>Try again</button>}</div>}
    <p className="integration-note">The payment form is securely provided by Ziina. Card details are entered into Ziina’s checkout and are not handled by Asanib.</p>
  </section></main>
}
