/**
 * Project Name: Callback Handler UI
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getTurnstileSecretKey,
  getTurnstileSiteKey,
  verifyTurnstileToken,
} from '../lib/turnstile.mjs'

test('turnstile helpers fall back to local test keys outside production', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const originalSecret = process.env.TURNSTILE_SECRET_KEY

  process.env.NODE_ENV = 'development'
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  delete process.env.TURNSTILE_SECRET_KEY

  assert.equal(getTurnstileSiteKey(), '1x00000000000000000000AA')
  assert.equal(getTurnstileSecretKey(), '1x0000000000000000000000000000000AA')

  process.env.NODE_ENV = originalNodeEnv

  if (typeof originalSiteKey === 'string') {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalSiteKey
  } else {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  }

  if (typeof originalSecret === 'string') {
    process.env.TURNSTILE_SECRET_KEY = originalSecret
  } else {
    delete process.env.TURNSTILE_SECRET_KEY
  }
})

test('verifyTurnstileToken requires a token', async () => {
  const result = await verifyTurnstileToken({
    token: '',
    action: 'feature_request',
  })

  assert.equal(result.success, false)
  assert.equal(result.error, 'Please complete the CAPTCHA challenge.')
})
