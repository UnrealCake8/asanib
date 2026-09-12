import { FormEvent, useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { watchAuth } from './lib/data'
import { getProviderPayoutSummary, requestProviderPayout, uploadBankAccountProof, type ProviderPayoutSummary } from './lib/marketplaceApi'

function money(fils: number) {
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', minimumFractionDigits: 2 }).format((Number(fils) || 0) / 100)
}

export default function ProviderPayouts() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [summary, setSummary] = useState<ProviderPayoutSummary | null>(null)
  const [method, setMethod] = useState<'bank' | 'payment_link'>('bank')
  const [bankAccountHolder, setBankAccountHolder] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankIban, setBankIban] = useState('')
  const [bankProofPath, setBankProofPath] = useState<string | null>(null)
  const [payoutPaymentLink, setPayoutPaymentLink] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => watchAuth((next) => { setUser(next); setReady(true) }), [])

  async function refresh() {
    setLoading(true); setError('')
    try {
      const next = await getProviderPayoutSummary()
      setSummary(next)
      setMethod(next.payoutMethod || 'bank')
      setBankAccountHolder(next.bankAccountHolder || '')
      setBankName(next.bankName || '')
      setBankIban(next.bankIban || '')
      setBankProofPath(next.bankProofPath || null)
      setPayoutPaymentLink(next.payoutPaymentLink || '')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load payouts.') }
    setLoading(false)
  }

  useEffect(() => {
    if (!ready) return
    if (!user || user.isAnonymous) { window.location.assign('/provider'); return }
    void refresh()
  }, [ready, user])

  async function upload(file?: File) {
    if (!file) return
    setUploading(true); setError(''); setMessage('')
    try {
      const path = await uploadBankAccountProof(file)
      setBankProofPath(path)
      setMessage('Bank proof uploaded securely.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not upload bank proof.') }
    setUploading(false)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true); setError(''); setMessage('')
    try {
      const payout = await requestProviderPayout({
        method,
        bankAccountHolder: method === 'bank' ? bankAccountHolder : undefined,
        bankName: method === 'bank' ? bankName : undefined,
        bankIban: method === 'bank' ? bankIban : undefined,
        bankProofPath: method === 'bank' ? bankProofPath : undefined,
        payoutPaymentLink: method === 'payment_link' ? payoutPaymentLink : undefined,
      })
      setMessage(`${money(payout.amountFils)} payout requested. Asanib will review and process it.`)
      await refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not request payout.') }
    setSubmitting(false)
  }

  if (!ready || loading) return <main className="payout-page"><div className="provider-loading">Loading payouts…</div></main>

  return <main className="payout-page">
    <header className="payout-header"><a href="/provider">← Business</a><a className="brand" href="/">asanib<span>.</span></a><span /></header>
    <div className="payout-wrap">
      <section className="payout-hero"><div><span>EARNINGS</span><h1>Payouts</h1><p>Track money received through Asanib Checkout and choose where your available balance should be sent.</p></div><div className="payout-available"><span>AVAILABLE TO CASH OUT</span><strong>{money(summary?.availableFils || 0)}</strong><small>{summary?.eligibleBookingCount || 0} paid completed job{summary?.eligibleBookingCount === 1 ? '' : 's'}</small></div></section>

      <section className="payout-stats"><article><span>Total earned</span><strong>{money(summary?.totalEarnedFils || 0)}</strong></article><article><span>Pending payout</span><strong>{money(summary?.pendingFils || 0)}</strong></article><article><span>Paid out</span><strong>{money(summary?.paidOutFils || 0)}</strong></article></section>

      {error && <div className="notice error">{error}</div>}
      {message && <div className="account-success">{message}</div>}

      <section className="payout-card"><div className="payout-card-head"><div><span>CASH OUT</span><h2>Where should we send it?</h2><p>Bank payouts require proof that the account exists. A custom payment link does not currently require proof.</p></div></div>
        <div className="payout-methods"><button type="button" className={method === 'bank' ? 'active' : ''} onClick={() => setMethod('bank')}><b>Bank transfer</b><span>UAE bank account · proof required</span></button><button type="button" className={method === 'payment_link' ? 'active' : ''} onClick={() => setMethod('payment_link')}><b>Custom payment link</b><span>HTTPS link · no proof required for now</span></button></div>

        <form onSubmit={submit}>
          {method === 'bank' ? <div className="payout-fields"><label>Account holder<input value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)} placeholder="As shown by the bank" required /></label><label>Bank name<input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Emirates NBD" required /></label><label className="wide">UAE IBAN<input value={bankIban} onChange={(e) => setBankIban(e.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="AE…" required /></label><label className={`payout-proof wide ${bankProofPath ? 'uploaded' : ''}`}><input type="file" accept="application/pdf,image/*" onChange={(e) => void upload(e.target.files?.[0])} /><b>{bankProofPath ? '✓ Bank proof uploaded' : 'Upload bank account proof'}</b><span>{uploading ? 'Uploading…' : bankProofPath ? 'Tap to replace · PDF/JPG/PNG/WebP' : 'Bank letter, statement header or official account confirmation'}</span></label></div> : <div className="payout-fields"><label className="wide">Custom payment link<input type="url" value={payoutPaymentLink} onChange={(e) => setPayoutPaymentLink(e.target.value)} placeholder="https://…" required /></label><div className="payout-note wide"><strong>No proof required at the moment.</strong><span>Asanib will send the payout to this link after the payout request is reviewed.</span></div></div>}
          <button className="primary payout-submit" disabled={submitting || uploading || !summary?.availableFils}>{submitting ? 'Requesting…' : summary?.availableFils ? `Cash out ${money(summary.availableFils)}` : 'No balance available'}</button>
        </form>
      </section>

      <section className="payout-card"><div className="payout-card-head"><div><span>HISTORY</span><h2>Recent payouts</h2></div></div><div className="payout-history">{summary?.payouts?.map((payout) => <article key={payout.id}><div><span className={`status-pill ${payout.status === 'paid' ? 'completed' : payout.status === 'rejected' ? 'cancelled' : 'pending'}`}>{payout.status}</span><strong>{payout.method === 'bank' ? 'Bank transfer' : 'Custom payment link'}</strong><small>{payout.destinationLabel || 'Destination saved'}</small></div><b>{money(payout.amountFils)}</b></article>)}{!summary?.payouts?.length && <div className="empty-state">No payouts requested yet.</div>}</div></section>
    </div>
  </main>
}
