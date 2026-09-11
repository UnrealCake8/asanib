import { FormEvent, useMemo, useState } from 'react'
import { firebaseConfigured } from './lib/firebase'
import type { ParsedRequest, ServiceRequestDraft, Urgency } from './types'

const examples = [
  'AC technician in Al Barsha right now under AED 200',
  'Sofa cleaning in Ajman tomorrow for under AED 180',
  'Someone to collect a package in Dubai and deliver it to Sharjah'
]

const categories = [
  ['Home', 'Cleaning, AC, handyman'],
  ['Send', 'Courier & errands'],
  ['Auto', 'Car wash, battery, tyres'],
  ['Beauty', 'At-home & nearby services']
]

function parseDraft(draft: ServiceRequestDraft): ParsedRequest {
  const q = draft.query.toLowerCase()
  const category = q.includes('ac') || q.includes('clean') || q.includes('handyman')
    ? 'Home services'
    : q.includes('package') || q.includes('deliver') || q.includes('courier')
      ? 'Send & errands'
      : q.includes('car') || q.includes('tyre') || q.includes('battery')
        ? 'Auto services'
        : q.includes('salon') || q.includes('beauty') || q.includes('hair')
          ? 'Beauty'
          : 'Local services'

  return {
    ...draft,
    category,
    summary: `${category}${draft.location ? ` near ${draft.location}` : ''}`
  }
}

function CustomerHome() {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [budget, setBudget] = useState('')
  const [urgency, setUrgency] = useState<Urgency>('now')
  const [request, setRequest] = useState<ParsedRequest | null>(null)

  const canSubmit = useMemo(() => query.trim().length >= 8, [query])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setRequest(parseDraft({
      query: query.trim(),
      location: location.trim(),
      budget: budget ? Number(budget) : undefined,
      urgency
    }))
  }

  if (request) {
    return <RequestView request={request} onBack={() => setRequest(null)} />
  }

  return (
    <main className="page home-page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Asanib home">asanib<span>.</span></a>
        <a className="provider-link" href="/provider">For providers</a>
      </header>

      <section className="hero">
        <div className="eyebrow">GET IT SORTED</div>
        <h1>What do you need <em>done?</em></h1>
        <p>Describe the job. Asanib helps you find people who can actually do it.</p>

        <form className="request-card" onSubmit={submit}>
          <label className="search-field">
            <span className="search-icon">⌕</span>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Find me an AC technician in Al Barsha right now..."
              rows={3}
            />
          </label>

          <div className="form-grid">
            <label>
              <span>Area</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Al Barsha, Dubai" />
            </label>
            <label>
              <span>Max budget</span>
              <div className="money-input"><b>AED</b><input inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))} placeholder="Optional" /></div>
            </label>
          </div>

          <div className="urgency-row" aria-label="When do you need it?">
            {(['now', 'today', 'scheduled'] as Urgency[]).map((value) => (
              <button type="button" className={urgency === value ? 'chip active' : 'chip'} onClick={() => setUrgency(value)} key={value}>
                {value === 'now' ? '⚡ Need it now' : value === 'today' ? 'Today' : 'Schedule'}
              </button>
            ))}
          </div>

          <button className="primary" disabled={!canSubmit}>Find someone</button>
        </form>

        <div className="example-strip">
          <span>Try:</span>
          {examples.map((example) => <button key={example} onClick={() => setQuery(example)}>{example}</button>)}
        </div>
      </section>

      <section className="browse">
        <div className="section-heading"><h2>Or browse</h2><span>Popular services</span></div>
        <div className="category-grid">
          {categories.map(([name, detail], index) => (
            <button className="category-card" key={name} onClick={() => setQuery(`Find me ${detail.split(',')[0].toLowerCase()} near me`)}>
              <span className={`category-icon icon-${index}`}>{['⌂', '↗', '◇', '✦'][index]}</span>
              <strong>{name}</strong>
              <small>{detail}</small>
            </button>
          ))}
        </div>
      </section>

      <footer className="status-footer">
        <span className={firebaseConfigured ? 'dot live' : 'dot'} />
        {firebaseConfigured ? 'Connected to Firebase' : 'Prototype mode · connect Firebase with .env.local'}
      </footer>
    </main>
  )
}

function RequestView({ request, onBack }: { request: ParsedRequest; onBack: () => void }) {
  return (
    <main className="page request-page">
      <header className="topbar"><button className="back" onClick={onBack}>←</button><a className="brand" href="/">asanib<span>.</span></a><span /></header>
      <section className="request-shell">
        <div className="request-badge">{request.urgency === 'now' ? '⚡ NEED IT NOW' : 'REQUEST'}</div>
        <h1>Finding the right people.</h1>
        <p className="request-query">“{request.query}”</p>
        <div className="request-facts">
          <div><span>Category</span><strong>{request.category}</strong></div>
          <div><span>Area</span><strong>{request.location || 'Not specified'}</strong></div>
          <div><span>Budget</span><strong>{request.budget ? `Up to AED ${request.budget}` : 'Open to quotes'}</strong></div>
        </div>
        <div className="matching-card">
          <div className="pulse"><i /><i /><i /></div>
          <div><strong>Ready to match providers</strong><p>The next build will send this request to verified providers who cover the area and are available.</p></div>
        </div>
        <button className="secondary" onClick={onBack}>Edit request</button>
      </section>
    </main>
  )
}

function ProviderPortal() {
  return (
    <main className="page provider-page">
      <header className="topbar"><a className="brand" href="/">asanib<span>.</span></a><a className="provider-link" href="/">Customer app</a></header>
      <section className="provider-hero">
        <div className="eyebrow">FOR PROVIDERS</div>
        <h1>Customers are already looking.</h1>
        <p>Tell Asanib what you do, where you work and when you're available. Relevant requests come to you.</p>
        <div className="provider-demo">
          <div className="demo-head"><span>New request</span><b>NOW</b></div>
          <h3>AC not cooling</h3>
          <p>Al Barsha · Apartment · Customer budget up to AED 200</p>
          <div className="demo-actions"><button>Pass</button><button className="primary compact">Send quote</button></div>
        </div>
        <button className="primary provider-cta">Join as a provider</button>
        <small className="fineprint">Free during the early Asanib launch. No obligation to accept jobs.</small>
      </section>
    </main>
  )
}

export default function App() {
  const path = window.location.pathname
  if (path.startsWith('/provider')) return <ProviderPortal />
  return <CustomerHome />
}
