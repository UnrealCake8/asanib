import assert from 'node:assert/strict'
import test from 'node:test'
import { networkInternationalConfig, orderReference, paymentStatus, toMinorUnits, validPaymentUrl } from '../server/api/_networkInternational.js'

test('Network International uses minor AED units without floating-point drift', () => {
  assert.equal(toMinorUnits(1), 100)
  assert.equal(toMinorUnits(10.5), 1050)
  assert.equal(toMinorUnits('123.45'), 12345)
  assert.throws(() => toMinorUnits(0), /invalid/)
})

test('Network International accepts only explicit sandbox or live configuration', () => {
  assert.equal(networkInternationalConfig({ NETWORK_INTERNATIONAL_ENVIRONMENT: 'sandbox', NETWORK_INTERNATIONAL_API_KEY: 'key', NETWORK_INTERNATIONAL_OUTLET_REF: 'outlet' }).baseUrl, 'https://api-gateway.sandbox.ngenius-payments.com')
  assert.equal(networkInternationalConfig({ NETWORK_INTERNATIONAL_ENVIRONMENT: 'live', NETWORK_INTERNATIONAL_API_KEY: 'key', NETWORK_INTERNATIONAL_OUTLET_REF: 'outlet' }).baseUrl, 'https://api-gateway.ngenius-payments.com')
  assert.throws(() => networkInternationalConfig({ NETWORK_INTERNATIONAL_ENVIRONMENT: 'staging' }), /sandbox or live/)
})

test('Network International order outcomes map conservatively', () => {
  assert.equal(paymentStatus({ action: 'PURCHASE', _embedded: { payment: [{ state: 'PURCHASED' }] } }), 'paid')
  assert.equal(paymentStatus({ action: 'PURCHASE', _embedded: { payment: [{ state: 'PURCHASED' }] } }, 'AUTHORISED'), 'pending')
  assert.equal(paymentStatus({ action: 'AUTH', _embedded: { payment: [{ state: 'AUTHORISED' }] } }), 'authorised')
  assert.equal(paymentStatus({ action: 'PURCHASE', _embedded: { payment: [{ state: 'FAILED' }] } }), 'failed')
  assert.equal(paymentStatus({ action: 'PURCHASE', _embedded: { payment: [{ state: 'STARTED' }] } }), 'pending')
  assert.equal(orderReference({ _id: 'urn:order:abc-123' }), 'abc-123')
  assert.equal(validPaymentUrl('https://paypage.sandbox.ngenius-payments.com/?code=abc', 'sandbox'), true)
  assert.equal(validPaymentUrl('https://example.com/?code=abc', 'sandbox'), false)
})
