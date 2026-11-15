# JSV Market

JSV Market is a UAE local-services marketplace operated by JS Ventures LLC. Customers describe the job they need, JSV Market matches relevant verified providers, providers send quotes, and customers choose who fits.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Core services

- Firebase Authentication and Firestore
- Cloudflare R2 for private KYB document storage
- Google Maps Platform for structured UAE place selection and matching
- Approved provider-hosted checkout links; platform checkout remains disabled pending payment-flow approval
- Vercel for the web app and API routes

## Vercel API architecture

All public `/api/*` endpoints are routed through a single Vercel Serverless Function at `api/[route].js`. The individual handlers live under `server/api/`. This keeps the deployment comfortably within the Hobby plan function limit while preserving the existing endpoint URLs.

## Platform checkout

JSV Market integrates with Network International’s N-Genius Hosted Payment Page. Payment details stay on Network International’s hosted page; JSV Market creates the order, records the reference and verifies the outcome through the order API and an authenticated webhook.

Configure and validate `NETWORK_INTERNATIONAL_ENVIRONMENT=sandbox` first. Set both `VITE_JSV_MARKET_CHECKOUT_ENABLED=true` and `PAYMENTS_ENABLED=true` only in the environment being tested. Live mode additionally requires the approved live API key, outlet reference, HTTPS return URL and whitelisted webhook.

## Security notes

Never commit real Firebase Admin, R2, Google Maps, or payment-provider credentials. Keep all server-only credentials in Vercel environment variables.
