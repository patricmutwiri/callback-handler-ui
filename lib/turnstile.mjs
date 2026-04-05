/**
 * Project Name: Callback Handler UI
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

const DEV_TURNSTILE_SITE_KEY = '1x00000000000000000000AA'
const DEV_TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA'
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export function getTurnstileSiteKey() {
  const configuredKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()

  if (configuredKey) {
    return configuredKey
  }

  return process.env.NODE_ENV === 'production' ? '' : DEV_TURNSTILE_SITE_KEY
}

export function getTurnstileSecretKey() {
  const configuredSecret = process.env.TURNSTILE_SECRET_KEY?.trim()

  if (configuredSecret) {
    return configuredSecret
  }

  return process.env.NODE_ENV === 'production' ? '' : DEV_TURNSTILE_SECRET_KEY
}

export async function verifyTurnstileToken({
  token,
  remoteIp,
  action,
}) {
  if (!token || typeof token !== 'string') {
    return {
      success: false,
      error: 'Please complete the CAPTCHA challenge.',
      errorCodes: ['missing-input-response'],
    }
  }

  const secret = getTurnstileSecretKey()

  if (!secret) {
    return {
      success: false,
      error: 'CAPTCHA verification is not configured.',
      errorCodes: ['missing-input-secret'],
    }
  }

  const payload = new URLSearchParams({
    secret,
    response: token,
    idempotency_key: crypto.randomUUID(),
  })

  if (remoteIp) {
    payload.set('remoteip', remoteIp)
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload.toString(),
  })

  if (!response.ok) {
    return {
      success: false,
      error: 'CAPTCHA verification failed. Please try again.',
      errorCodes: ['verification-unavailable'],
    }
  }

  const result = await response.json()

  if (!result.success) {
    return {
      success: false,
      error: 'CAPTCHA verification failed. Please try again.',
      errorCodes: result['error-codes'] ?? [],
    }
  }

  if (action && result.action && result.action !== action) {
    return {
      success: false,
      error: 'CAPTCHA action did not match the request.',
      errorCodes: ['action-mismatch'],
    }
  }

  return {
    success: true,
    error: null,
    errorCodes: [],
  }
}
