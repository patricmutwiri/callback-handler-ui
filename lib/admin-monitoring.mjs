/**
 * Project Name: WooCommerce Dynamics Sync
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

import { kv } from '@vercel/kv'
import PusherServer from 'pusher'

const ADMIN_ALERTS_KEY = 'admin:alerts'
const DELETION_AUDIT_KEY = 'audit:deletion-requests'
const ADMIN_ALERT_CHANNEL = 'admin-activity'
const ADMIN_ALERT_EVENT = 'admin-alert'

export function parseAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

function createPusherServer() {
  if (
    !process.env.PUSHER_APP_ID ||
    !process.env.PUSHER_KEY ||
    !process.env.PUSHER_SECRET ||
    !process.env.PUSHER_CLUSTER
  ) {
    return null
  }

  return new PusherServer({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    useTLS: true,
  })
}

export async function publishAdminAlert({
  type,
  slug,
  message,
  metadata = {},
}) {
  const alert = {
    id: crypto.randomUUID(),
    type,
    slug,
    message,
    metadata,
    timestamp: new Date().toISOString(),
  }

  await kv.lpush(ADMIN_ALERTS_KEY, JSON.stringify(alert))
  await kv.ltrim(ADMIN_ALERTS_KEY, 0, 99)

  const pusherServer = createPusherServer()

  if (pusherServer) {
    await pusherServer.trigger(ADMIN_ALERT_CHANNEL, ADMIN_ALERT_EVENT, alert)
  }

  return alert
}

export async function logDeletionAuditEvent(event) {
  const auditEvent = {
    ...event,
    id: event.id || crypto.randomUUID(),
    timestamp: event.timestamp || new Date().toISOString(),
  }

  await kv.lpush(DELETION_AUDIT_KEY, JSON.stringify(auditEvent))
  await kv.ltrim(DELETION_AUDIT_KEY, 0, 499)

  return auditEvent
}

export async function anonymizeAdminRequestLogForSlug(slug) {
  const rawRows = await kv.lrange('admin:requests', 0, 499)
  const rows = Array.isArray(rawRows) ? rawRows : []

  const rewrittenRows = rows.map((item) => {
    let parsed = item

    if (typeof item === 'string') {
      try {
        parsed = JSON.parse(item)
      } catch {
        return item
      }
    }

    if (!parsed || typeof parsed !== 'object' || parsed.slug !== slug) {
      return JSON.stringify(parsed)
    }

    return JSON.stringify({
      ...parsed,
      ownerEmail: null,
    })
  })

  await kv.del('admin:requests')

  if (rewrittenRows.length > 0) {
    await kv.rpush('admin:requests', ...rewrittenRows)
  }
}

export const adminAlertChannel = ADMIN_ALERT_CHANNEL
export const adminAlertEvent = ADMIN_ALERT_EVENT
