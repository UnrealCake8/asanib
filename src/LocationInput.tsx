import { useEffect, useRef, useState } from 'react'
import { ensureCustomerUser } from './lib/data'

type Suggestion = {
  placeId: string
  text: string
  mainText: string
  secondaryText: string
}

export default function LocationInput({
  value,
  onChange,
  placeholder = 'Al Barsha, Dubai',
  required = false,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const sessionToken = useRef(globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
  const requestNumber = useRef(0)

  useEffect(() => {
    const input = value.trim()
    if (input.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }

    const timer = window.setTimeout(async () => {
      const requestId = ++requestNumber.current
      setLoading(true)
      try {
        const user = await ensureCustomerUser()
        const token = await user.getIdToken()
        const response = await fetch('/api/location-autocomplete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ input, sessionToken: sessionToken.current }),
        })
        const payload = await response.json().catch(() => ({})) as { suggestions?: Suggestion[] }
        if (requestId !== requestNumber.current) return
        setSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : [])
        setOpen(response.ok && Array.isArray(payload.suggestions) && payload.suggestions.length > 0)
      } catch {
        if (requestId === requestNumber.current) {
          setSuggestions([])
          setOpen(false)
        }
      } finally {
        if (requestId === requestNumber.current) setLoading(false)
      }
    }, 250)

    return () => window.clearTimeout(timer)
  }, [value])

  function choose(suggestion: Suggestion) {
    onChange(suggestion.text)
    setSuggestions([])
    setOpen(false)
    sessionToken.current = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
  }

  return <div className="location-input-wrap">
    <input
      value={value}
      onChange={(event) => { onChange(event.target.value); setOpen(true) }}
      onFocus={() => suggestions.length && setOpen(true)}
      onBlur={() => window.setTimeout(() => setOpen(false), 140)}
      placeholder={placeholder}
      required={required}
      autoComplete="off"
      inputMode="text"
      aria-autocomplete="list"
      aria-expanded={open}
    />
    {loading && <span className="location-loading">Finding…</span>}
    {open && suggestions.length > 0 && <div className="location-suggestions" role="listbox">
      {suggestions.map((suggestion) => <button type="button" key={suggestion.placeId} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(suggestion)}>
        <strong>{suggestion.mainText}</strong>
        {suggestion.secondaryText && <span>{suggestion.secondaryText}</span>}
      </button>)}
      <small>Powered by Google</small>
    </div>}
  </div>
}
