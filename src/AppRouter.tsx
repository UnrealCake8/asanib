import App from './App'
import ProviderHub from './ProviderHub'
import LegalPage from './LegalPages'

export default function AppRouter() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'

  if (path === '/provider' || path.startsWith('/provider/')) return <ProviderHub />
  if (path === '/privacy') return <LegalPage kind="privacy" />
  if (path === '/terms') return <LegalPage kind="terms" />
  if (path === '/cookies') return <LegalPage kind="cookies" />
  if (path === '/refunds') return <LegalPage kind="refunds" />

  return <App />
}
