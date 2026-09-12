import { adminDb } from './_firebaseAdmin.js'
import { exchangeCode, getZiinaAccount, registerProviderWebhook, saveConnection } from './_ziina.js'

function appOrigin() {
  const configured = String(process.env.VITE_APP_URL || process.env.APP_URL || '').trim()
  return configured.replace(/\/$/, '') || 'https://asanib.com'
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed')
  const code = String(req.query?.code || '').trim()
  const state = String(req.query?.state || '').trim()
  const error = String(req.query?.error || '').trim()
  const destination = `${appOrigin()}/provider/ziina`

  try {
    if (error) return res.redirect(`${destination}?error=${encodeURIComponent(error)}`)
    if (!code || !state) return res.redirect(`${destination}?error=${encodeURIComponent('Missing Ziina authorization response.')}`)

    const stateRef = adminDb.collection('ziinaOAuthStates').doc(state)
    const stateSnap = await stateRef.get()
    if (!stateSnap.exists || Number(stateSnap.data()?.expiresAtMs || 0) < Date.now()) {
      return res.redirect(`${destination}?error=${encodeURIComponent('Ziina connection session expired. Please try again.')}`)
    }
    const providerId = String(stateSnap.data()?.providerId || '')
    await stateRef.delete()

    const tokens = await exchangeCode(code)
    const account = await getZiinaAccount(tokens.access_token)
    if (account.account_type !== 'business') {
      return res.redirect(`${destination}?error=${encodeURIComponent('Please connect a Ziina Business account.')}`)
    }
    if (account.status !== 'active') {
      await saveConnection(providerId, tokens, account)
      return res.redirect(`${destination}?error=${encodeURIComponent('Your Ziina Business account must be active before Asanib Checkout can be enabled.')}`)
    }

    await saveConnection(providerId, tokens, account)
    let webhook = false
    try { webhook = await registerProviderWebhook(tokens.access_token) } catch { webhook = false }
    return res.redirect(`${destination}?connected=1&webhook=${webhook ? '1' : '0'}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not connect Ziina.'
    return res.redirect(`${destination}?error=${encodeURIComponent(message)}`)
  }
}
