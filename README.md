# Asanib

Asanib is a mobile-first local-services marketplace. Customers post a real service request, approved providers see matching jobs and send quotes, and the customer can accept a quote to create a booking.

## What works in V1

- Anonymous customer sessions through Firebase Auth
- Real Firestore-backed service requests
- Location, budget, urgency and scheduled requests
- Persistent `/request/:id` request pages
- Live provider quotes on customer requests
- Email/password provider accounts
- Provider onboarding with service categories and coverage areas
- Admin approval before a provider can quote
- Provider availability toggle
- Provider-side request matching
- Quotes with amount, ETA and message
- Customer quote acceptance
- Booking creation and provider job-status updates
- Customer request and booking history
- Admin provider approval and request monitoring
- Installable PWA

Payments are intentionally outside V1. The accepted quote creates a booking and the customer pays the provider directly.

## Firebase setup

1. Create a Firebase project and Web App.
2. Enable **Authentication → Anonymous**.
3. Enable **Authentication → Email/Password**.
4. Create a Firestore database.
5. Copy `.env.example` to `.env.local` and add the Firebase Web App values.
6. Deploy `firestore.rules` and `firestore.indexes.json`.
7. For the first admin, create `admins/<ADMIN_UID>` in Firestore. The document can contain any small marker such as `{ "active": true }`.

Example Firebase CLI deployment:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Build

```bash
npm run build
```

## Main routes

- `/` customer app
- `/request/:id` live request and quotes
- `/provider` provider sign-in, onboarding and dashboard
- `/admin` provider approvals and operations
