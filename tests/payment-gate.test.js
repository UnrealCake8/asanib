import assert from 'node:assert/strict'
import test from 'node:test'
import { paymentFlowEnabled } from '../server/api/_payments.js'

test('live payment creation requires explicit server approval', () => {
  assert.equal(paymentFlowEnabled({}), false)
  assert.equal(paymentFlowEnabled({ PAYMENTS_ENABLED: 'false' }), false)
  assert.equal(paymentFlowEnabled({ PAYMENTS_ENABLED: 'TRUE' }), false)
  assert.equal(paymentFlowEnabled({ PAYMENTS_ENABLED: 'true' }), true)
})
