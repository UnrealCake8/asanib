import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import AppRouter from './AppRouter'
import { watchAuth } from './lib/data'
import { syncPushIfAlreadyAllowed } from './lib/notifications'
import './styles.css'
import './functional.css'
import './customer.css'
import './product.css'
import './v2.css'
import './ziina.css'

registerSW({ immediate: true })

watchAuth((user) => {
  if (user) void syncPushIfAlreadyAllowed()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>
)
