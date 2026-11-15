import CustomerAppV2 from './CustomerAppV2'
import ExternalMatchedRequest from './ExternalMatchedRequest'
import ProviderHubV3 from './ProviderHubV3'
import ProviderPayouts from './ProviderPayouts'
import AdminV2 from './AdminV2'
import ExternalOps from './ExternalOps'
import LegalPage from './LegalPages'
import NetworkCheckoutPage from './NetworkCheckoutPage'

function OperatorFooter() {
  return <footer className="global-operator-footer"><div><span>JSV Market is operated by <strong>JS Ventures LLC</strong> in the United Arab Emirates.</span><nav><a href="/privacy">Privacy Policy</a><a href="/terms">Terms & Conditions</a><a href="/cookies">Cookie Policy</a><a href="/refunds">Refund Policy</a><a href="/provider">For providers</a></nav></div></footer>
}

export default function AppRouter() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  const requestMatch = path.match(/^\/request\/([^/]+)$/)

  if (path === '/checkout/complete') return <NetworkCheckoutPage />
  if (requestMatch) return <><ExternalMatchedRequest requestId={requestMatch[1]} /><OperatorFooter /></>
  if (path === '/provider/payouts') return <ProviderPayouts />
  if (path === '/provider' || path.startsWith('/provider/')) return <ProviderHubV3 />
  if (path === '/admin/external') return <ExternalOps />
  if (path === '/admin' || path.startsWith('/admin/')) return <AdminV2 />
  if (path === '/privacy') return <LegalPage kind="privacy" />
  if (path === '/terms') return <LegalPage kind="terms" />
  if (path === '/cookies') return <LegalPage kind="cookies" />
  if (path === '/refunds') return <LegalPage kind="refunds" />

  return <><CustomerAppV2 /><OperatorFooter /></>
}
