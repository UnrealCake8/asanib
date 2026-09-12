# Asanib

Asanib is a UAE local-services marketplace operated by JS Ventures LLC. Customers describe the job they need, Asanib matches relevant verified providers, providers send quotes, and customers choose who fits.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Core services

- Firebase Authentication and Firestore
- Cloudflare R2 for private KYB document storage
- Google Maps Platform for structured UAE place selection and matching
- Ziina for provider-connected embedded Asanib Checkout
- Vercel for the web app and API routes

## Ziina Checkout

Asanib Checkout uses Ziina OAuth so verified providers connect their own Ziina Business account. Payment intents are created using the provider-authorised Ziina token, and the payment form is shown inside Asanib using Ziina's `embedded_url`. The underlying service payment is received by the connected provider's Ziina wallet rather than held by JS Ventures LLC.

Ziina OAuth access is reviewed case-by-case. Before production use, ask Ziina to approve the Asanib application, redirect URI and requested scopes. Configure the server-only environment variables shown in `.env.example`, register the webhook URL, and complete Ziina's embedded-checkout domain approval and Apple Pay domain-verification requirement.

Keep `ZIINA_TEST_MODE=true` until the full flow has been tested and Ziina has approved production use.

## Security notes

Never commit real Firebase Admin, R2, Google Maps server, Ziina OAuth, or webhook credentials. Provider Ziina tokens are stored only in server-side Firestore collections that have no client rule allowing access.
