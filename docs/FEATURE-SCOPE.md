# Feature scope: geo matching, KYB, provider checkout and mobile PWA

This branch introduces the first production-oriented version of the following Asanib capabilities:

- Structured UAE location matching using Google Maps Platform on the server.
- Customer location autocomplete restricted to the UAE.
- Broad service-area matching so providers covering Dubai can match neighbourhood requests such as Al Barsha.
- Provider KYB collection and review, including private trade-licence uploads.
- Separate review and approval of provider external checkout links.
- Snapshotting approved checkout destinations onto quotes and bookings.
- Customer post-acceptance payment-choice flow for provider checkout.
- A feature-gated slot for future embedded Ziina-powered Asanib Checkout.
- New mobile-first customer and provider PWA shells with bottom navigation.
- New admin review workspace for KYB and payment-link approvals.

Asanib Checkout itself is intentionally not enabled by this branch; the external provider checkout flow is live once a provider's payment link has been approved.
