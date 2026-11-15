import { useEffect, useState } from 'react'
import { getNetworkPaymentStatus } from './lib/marketplaceApi'

export default function NetworkCheckoutPage() {
  const bookingId = new URLSearchParams(window.location.search).get('bookingId') || ''
  const [status, setStatus] = useState('checking')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!bookingId) { setError('The booking reference is missing.'); return }
    void getNetworkPaymentStatus(bookingId)
      .then((result) => setStatus(result.status))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not verify the payment.'))
  }, [bookingId])

  return <main className="network-return"><a className="brand" href="/">JSV Market</a><section><h1>{status === 'paid' ? 'Payment confirmed' : status === 'failed' ? 'Payment not completed' : 'Checking your payment'}</h1>{error ? <p>{error}</p> : <p>{status === 'paid' ? 'Your Network International payment is recorded against the booking.' : status === 'failed' ? 'Return to your booking to try again or arrange payment with the provider.' : 'JSV Market is confirming the result with Network International.'}</p>}<a href="/">Return to your bookings</a></section></main>
}
