import acceptQuote from '../server/api/accept-quote.js'
import adminExternalDispatch from '../server/api/admin-external-dispatch.js'
import adminExternalProvider from '../server/api/admin-external-provider.js'
import adminKybDocument from '../server/api/admin-kyb-document.js'
import adminPayoutReview from '../server/api/admin-payout-review.js'
import adminProviderReview from '../server/api/admin-provider-review.js'
import cancelRequest from '../server/api/cancel-request.js'
import createRequest from '../server/api/create-request.js'
import kybUploadUrl from '../server/api/kyb-upload-url.js'
import locationAutocomplete from '../server/api/location-autocomplete.js'
import locationDetails from '../server/api/location-details.js'
import payoutUploadUrl from '../server/api/payout-upload-url.js'
import providerPayoutSummary from '../server/api/provider-payout-summary.js'
import registerPush from '../server/api/register-push.js'
import requestPayout from '../server/api/request-payout.js'
import submitQuote from '../server/api/submit-quote.js'
import updateBooking from '../server/api/update-booking.js'
import updateProviderProfile from '../server/api/update-provider-profile.js'
import ziinaCheckout from '../server/api/ziina-checkout.js'
import ziinaPaymentStatus from '../server/api/ziina-payment-status.js'
import ziinaWebhook from '../server/api/ziina-webhook.js'

const handlers = {
  'accept-quote': acceptQuote,
  'admin-external-dispatch': adminExternalDispatch,
  'admin-external-provider': adminExternalProvider,
  'admin-kyb-document': adminKybDocument,
  'admin-payout-review': adminPayoutReview,
  'admin-provider-review': adminProviderReview,
  'cancel-request': cancelRequest,
  'create-request': createRequest,
  'kyb-upload-url': kybUploadUrl,
  'location-autocomplete': locationAutocomplete,
  'location-details': locationDetails,
  'payout-upload-url': payoutUploadUrl,
  'provider-payout-summary': providerPayoutSummary,
  'register-push': registerPush,
  'request-payout': requestPayout,
  'submit-quote': submitQuote,
  'update-booking': updateBooking,
  'update-provider-profile': updateProviderProfile,
  'ziina-checkout': ziinaCheckout,
  'ziina-payment-status': ziinaPaymentStatus,
  'ziina-webhook': ziinaWebhook,
}

export default async function handler(req, res) {
  const route = String(req.query?.route || '').trim()
  const selected = handlers[route]
  if (!selected) return res.status(404).json({ error: 'API route not found.' })
  return selected(req, res)
}
