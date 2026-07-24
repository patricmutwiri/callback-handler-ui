import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isKvAdminRequestLogEnabled,
  isKvRequestAlertsEnabled,
  isKvRequestStatsEnabled,
  isOptionalRequestMetricsEnabled,
  isRedisQuotaError,
} from '../lib/kv-usage.mjs'

const ENV_KEYS = ['KV_REQUEST_STATS', 'KV_ADMIN_REQUEST_LOG', 'KV_REQUEST_ALERTS']

function withEnv(overrides, fn) {
  const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))

  for (const key of ENV_KEYS) {
    delete process.env[key]
  }

  Object.assign(process.env, overrides)

  try {
    fn()
  } finally {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = saved[key]
      }
    }
  }
}

test('optional request metrics are disabled by default', () => {
  withEnv({}, () => {
    assert.equal(isKvRequestStatsEnabled(), false)
    assert.equal(isKvAdminRequestLogEnabled(), false)
    assert.equal(isKvRequestAlertsEnabled(), false)
    assert.equal(isOptionalRequestMetricsEnabled(), false)
  })
})

test('optional request metrics honor explicit env flags', () => {
  withEnv({ KV_REQUEST_STATS: 'true' }, () => {
    assert.equal(isKvRequestStatsEnabled(), true)
    assert.equal(isOptionalRequestMetricsEnabled(), true)
  })
})

test('isRedisQuotaError detects Upstash quota errors', () => {
  assert.equal(
    isRedisQuotaError(new Error('ERR max requests limit exceeded. Limit: 500000')),
    true
  )
  assert.equal(isRedisQuotaError(new Error('connection reset')), false)
})
