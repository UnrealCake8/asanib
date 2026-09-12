# Review checklist

Before merging to production:

- [ ] CI build passes.
- [ ] Google Cloud billing is enabled for the selected project.
- [ ] Places API (New) is enabled.
- [ ] Geocoding API is enabled.
- [ ] `GOOGLE_MAPS_API_KEY` is set in Vercel and restricted to the required APIs.
- [ ] Firebase Storage is enabled.
- [ ] `FIREBASE_STORAGE_BUCKET` is set in Vercel.
- [ ] Firebase Storage rules are deployed with `firebase deploy --only storage`.
- [ ] Test a Dubai-wide provider against an Al Barsha customer request.
- [ ] Test provider KYB submission and admin verification.
- [ ] Test payment-link approval, quote snapshotting and post-acceptance external checkout.
- [ ] Keep `VITE_ASANIB_CHECKOUT_ENABLED=false` until embedded Ziina checkout is implemented and tested.
