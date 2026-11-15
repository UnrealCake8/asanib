export function paymentFlowEnabled(env = process.env) {
  return env.PAYMENTS_ENABLED === 'true'
}
