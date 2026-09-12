# Asanib

Asanib is a UAE local-services marketplace operated by JS Ventures LLC. Customers describe the job they need, Asanib matches relevant verified providers, providers send quotes, and customers choose who fits.

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
- Ziina for Asanib Checkout through the JS Ventures LLC Ziina Business account
- Vercel for the web app and API routes

## Vercel API architecture

All public `/api/*` endpoints are routed through a single Vercel Serverless Function at `api/[route].js`. The individual handlers live under `server/api/`. This keeps the deployment comfortably within the Hobby plan function limit while preserving the existing endpoint URLs.

## Ziina Checkout

Asanib Checkout uses the JS Ventures LLC Ziina Business account. Customers pay inside Asanib using Ziina's embedded checkout, and the payment is received into JS Ventures LLC's Ziina account and recorded against the Asanib booking. Provider settlement is handled separately.

Keep `ZIINA_TEST_MODE=true` until the full payment flow has been tested and the production domain is approved for embedded checkout.

## Security notes

Never commit real Firebase Admin, R2, Google Maps server, Ziina API, or webhook credentials. Keep all server-only credentials in Vercel environment variables.
