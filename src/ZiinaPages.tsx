import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { watchAuth } from './lib/data'
import { getAsanibCheckoutStatus, startAsanibCheckout } from './lib/marketplaceApi'

function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => watchAuth((next) => { setUser(next); setReady(true) }), [])
  return { user, ready }
}

export function ZiinaCheckoutPage({ bookingId }: { bookingId: string }) {
  const { user, ready } = useUser()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('not_started')

  async function begin() {
    setBusy(true); setError('')
    try {
      const result = await startAsanibCheckout(bookingId)
      if (!result.redirectUrl || !result.redirectUrl.startsWith('https://pay.ziina.com/')) throw new Error('Ziina did not return a valid hosted checkout URL.')
      window.location.assign(result.redirectUrl)
      return
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Ziina Checkout.')
    }
    setBusy(false)
  }

  useEffect(() => {
    if (!ready || !user || user.isAnonymous) return
    const params = new URLSearchParams(window.location.search)
    const payment = params.get('payment')
    if (payment === 'success') {
      setStatus('checking')
      void getAsanibCheckoutStatus(bookingId).then((result) => setStatus(result.status)).catch(() => setStatus('checking'))
      return
    }
    if (payment === 'cancelled' || payment === 'failed') {
      setStatus(payment === 'cancelled' ? 'canceled' : 'failed')
      return
    }
    if (status === 'not_started' && !busy) void begin()
  }, [ready, user])

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

  if (status === 'paid') return <main className="ziina-page"><section className="ziina-card checkout-complete"><span className="checkout-success-mark">✓</span><span className="eyebrow">PAYMENT CONFIRMED</span><h1>Paid securely with Ziina</h1><p>Your payment through Asanib Checkout to JS Ventures LLC has been confirmed for this booking.</p><a className="primary ziina-link-button" href="/">Back to bookings</a></section></main>

  return <main className="ziina-page"><section className="ziina-card checkout-shell"><div className="ziina-card-head"><a className="brand" href="/">asanib<span>.</span></a><a href="/">Close</a></div><span className="eyebrow">ASANIB CHECKOUT · POWERED BY ZIINA</span><h1>{status === 'checking' ? 'Confirming your payment…' : 'Continue to secure payment'}</h1><p className="integration-note">You’ll be redirected to <strong>pay.ziina.com</strong> to complete payment securely. After payment, Ziina will return you to Asanib.</p>{error && <div className="notice error">{error}</div>}{(status === 'failed' || status === 'canceled') && <div className="notice error">Payment {status}. You can try again.</div>}
    {status === 'checking' ? <div className="checkout-loading">Checking payment status…</div> : <div className="checkout-loading">{busy ? 'Opening Ziina…' : <button className="primary" onClick={() => void begin()}>Pay securely with Ziina</button>}</div>}
  </section></main>
}
