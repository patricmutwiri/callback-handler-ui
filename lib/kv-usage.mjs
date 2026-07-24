/**
 * Project Name: Callback Handler UI
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-07-24
 */

import { kv } from '@vercel/kv'
import { publishAdminAlert } from './admin-monitoring.mjs'
import { SLUG_RETENTION_SECONDS } from './slug-access.mjs'

function envFlag(name, defaultValue = false) {
  const raw = process.env[name]
  if (raw === undefined || raw === '') {
    return defaultValue
  }

  return raw === 'true' || raw === '1'
}

/** Daily counters and aggregate stats (4+ incr commands per webhook). Off by default. */
export function isKvRequestStatsEnabled() {
  return envFlag('KV_REQUEST_STATS', false)
}

/** Admin dashboard request feed (lpush + ltrim per webhook). Off by default. */
export function isKvAdminRequestLogEnabled() {
  return envFlag('KV_ADMIN_REQUEST_LOG', false)
}

/** Real-time admin alerts for every logged request (2+ commands each). Off by default. */
export function isKvRequestAlertsEnabled() {
  return envFlag('KV_REQUEST_ALERTS', false)
}

export function isOptionalRequestMetricsEnabled() {
  return (
    isKvRequestStatsEnabled() ||
    isKvAdminRequestLogEnabled() ||
    isKvRequestAlertsEnabled()
  )
}

export function isRedisQuotaError(error) {
  const message = String(error?.message || error || '')
  return (
    message.includes('max requests limit exceeded') ||
    message.includes('ERR max requests')
  )
}

export async function kvSetWithRetention(key, value) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value)
  await kv.set(key, serialized, { ex: SLUG_RETENTION_SECONDS })
}

export async function persistRecordedRequest(key, requestData, { trimList = false } = {}) {
  try {
    await kv.lpush(key, JSON.stringify(requestData))

    if (trimList) {
      await kv.ltrim(key, 0, 99)
    }

    return true
  } catch (error) {
    if (isRedisQuotaError(error)) {
      console.warn('Redis quota exceeded; request not persisted for key:', key)
      return false
    }

    throw error
  }
}

export async function recordOptionalRequestMetrics({
  slug,
  requestData,
  hasAuthenticatedOwner,
  ownerRaw,
}) {
  if (!isOptionalRequestMetricsEnabled()) {
    return
  }

  const today = requestData.timestamp.split('T')[0]
  const work = []

  if (isKvAdminRequestLogEnabled()) {
    const adminRequestData = {
      id: requestData.id,
      slug,
      timestamp: requestData.timestamp,
      method: requestData.method,
      ip: requestData.ip,
      responseStatus: requestData.responseStatus,
      accessType: hasAuthenticatedOwner ? 'authenticated' : 'guest',
      ownerEmail:
        typeof ownerRaw === 'string'
          ? (() => {
              try {
                return JSON.parse(ownerRaw).email ?? null
              } catch {
                return null
              }
            })()
          : ownerRaw?.email ?? null,
    }

    work.push(
      kv.lpush('admin:requests', JSON.stringify(adminRequestData)),
      kv.ltrim('admin:requests', 0, 499)
    )
  }

  if (isKvRequestStatsEnabled()) {
    work.push(
      kv.incr('stats:requests:all-time'),
      kv.incr(
        hasAuthenticatedOwner
          ? 'stats:requests:authenticated'
          : 'stats:requests:guest'
      ),
      kv.incr(`stats:total:${today}`),
      kv.incr(`stats:slug:${slug}:${today}`)
    )
  }

  if (work.length > 0) {
    await Promise.all(work)
  }

  if (isKvRequestAlertsEnabled()) {
    await publishAdminAlert({
      type: 'request-logged',
      slug,
      message: `${requestData.method} request logged for ${slug}.`,
      metadata: {
        requestId: requestData.id,
        responseStatus: requestData.responseStatus ?? 200,
        accessType: hasAuthenticatedOwner ? 'authenticated' : 'guest',
      },
    })
  }

}
