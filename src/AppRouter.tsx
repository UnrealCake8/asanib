import App from './App'
import ProviderHub from './ProviderHub'
import LegalPage from './LegalPages'

function OperatorFooter() {
  return <footer className="global-operator-footer"><div><span>Asanib is operated by <strong>JS Ventures LLC</strong> in the United Arab Emirates.</span><nav><a href="/privacy">Privacy Policy</a><a href="/terms">Terms & Conditions</a><a href="/cookies">Cookie Policy</a><a href="/refunds">Refund Policy</a><a href="/provider">For providers</a></nav></div></footer>
}

export default function AppRouter() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'

  if (path === '/provider' || path.startsWith('/provider/')) return <ProviderHub />
  if (path === '/privacy') return <LegalPage kind="privacy" />
  if (path === '/terms') return <LegalPage kind="terms" />
  if (path === '/cookies') return <LegalPage kind="cookies" />
  if (path === '/refunds') return <LegalPage kind="refunds" />

  return <><App /><OperatorFooter /></>
}
