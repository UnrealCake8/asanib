import acceptQuote from '../server/api/accept-quote.js'
import adminKybDocument from '../server/api/admin-kyb-document.js'
import adminProviderReview from '../server/api/admin-provider-review.js'
import cancelRequest from '../server/api/cancel-request.js'
import createRequest from '../server/api/create-request.js'
import kybUploadUrl from '../server/api/kyb-upload-url.js'
import locationAutocomplete from '../server/api/location-autocomplete.js'
import locationDetails from '../server/api/location-details.js'
import registerPush from '../server/api/register-push.js'
import submitQuote from '../server/api/submit-quote.js'
import updateBooking from '../server/api/update-booking.js'
import updateProviderProfile from '../server/api/update-provider-profile.js'
import ziinaCheckout from '../server/api/ziina-checkout.js'
import ziinaPaymentStatus from '../server/api/ziina-payment-status.js'
import ziinaWebhook from '../server/api/ziina-webhook.js'

const handlers = {
  'accept-quote': acceptQuote,
  'admin-kyb-document': adminKybDocument,
  'admin-provider-review': adminProviderReview,
  'cancel-request': cancelRequest,
  'create-request': createRequest,
  'kyb-upload-url': kybUploadUrl,
  'location-autocomplete': locationAutocomplete,
  'location-details': locationDetails,
  'register-push': registerPush,
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
