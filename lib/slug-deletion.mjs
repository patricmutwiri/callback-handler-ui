/**
 * Project Name: WooCommerce Dynamics Sync
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

export const DELETION_HOLD_MS = 24 * 60 * 60 * 1000

export function buildDeletionRequestRecord({ slug, user, reason, now = new Date() }) {
  const requestedAt = now.toISOString()
  const eligibleAfter = new Date(now.getTime() + DELETION_HOLD_MS).toISOString()

  return {
    id: crypto.randomUUID(),
    slug,
    status: 'pending',
    requestedAt,
    eligibleAfter,
    reason,
    requestedBy: {
      id: user?.id ?? null,
      email: user?.email ?? null,
      name: user?.name ?? null,
    },
  }
}

export function readDeletionRequestRecord(rawValue) {
  if (!rawValue) {
    return null
  }

  return typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue
}

export function isDeletionRequestEligible(record, now = new Date()) {
  if (!record?.eligibleAfter) {
    return false
  }

  const eligibleAt = new Date(record.eligibleAfter)

  if (Number.isNaN(eligibleAt.getTime())) {
    return false
  }

  return eligibleAt.getTime() <= now.getTime()
}

export function sanitizeOwnerForArchive(owner) {
  if (!owner || typeof owner !== 'object') {
    return null
  }

  return {
    createdAt: owner.createdAt ?? null,
    anonymized: true,
  }
}

export function sanitizeDeletionRequestForArchive(record) {
  if (!record || typeof record !== 'object') {
    return null
  }

  return {
    id: record.id ?? null,
    slug: record.slug ?? null,
    status: record.status ?? 'pending',
    requestedAt: record.requestedAt ?? null,
    eligibleAfter: record.eligibleAfter ?? null,
    reason: record.reason ?? null,
    requestedBy: {
      anonymized: true,
    },
  }
}
