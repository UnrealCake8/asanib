import CustomerAppV2 from './CustomerAppV2'
import ProviderHubV2 from './ProviderHubV2'
import AdminV2 from './AdminV2'
import LegalPage from './LegalPages'

function OperatorFooter() {
  return <footer className="global-operator-footer"><div><span>Asanib is operated by <strong>JS Ventures LLC</strong> in the United Arab Emirates.</span><nav><a href="/privacy">Privacy Policy</a><a href="/terms">Terms & Conditions</a><a href="/cookies">Cookie Policy</a><a href="/refunds">Refund Policy</a><a href="/provider">For providers</a></nav></div></footer>
}

export default function AppRouter() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'

  if (path === '/provider' || path.startsWith('/provider/')) return <ProviderHubV2 />
  if (path === '/admin' || path.startsWith('/admin/')) return <AdminV2 />
  if (path === '/privacy') return <LegalPage kind="privacy" />
  if (path === '/terms') return <LegalPage kind="terms" />
  if (path === '/cookies') return <LegalPage kind="cookies" />
  if (path === '/refunds') return <LegalPage kind="refunds" />

  return <><CustomerAppV2 /><OperatorFooter /></>
}
