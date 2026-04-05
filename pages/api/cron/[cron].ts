import { kv } from '@vercel/kv'
import { NextApiRequest, NextApiResponse } from 'next'
import {
  anonymizeAdminRequestLogForSlug,
  logDeletionAuditEvent,
  publishAdminAlert,
} from '../../../lib/admin-monitoring.mjs'
import {
  isDeletionRequestEligible,
  readDeletionRequestRecord,
  sanitizeDeletionRequestForArchive,
  sanitizeOwnerForArchive,
} from '../../../lib/slug-deletion.mjs'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { cron } = req.query
  if (!cron) return res.status(400).json({ error: 'No cron provided' })
  
  const [summary, deletionProcessing] = await Promise.all([
    generateDailySummary(),
    processPendingDeletionRequests(),
  ])

  return res.status(200).json({
    summary,
    deletionProcessing,
  })
}

async function generateDailySummary() {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateStr = yesterday.toISOString().split('T')[0]

  const totalHitsKey = `stats:total:${dateStr}`
  const totalHits = await kv.get(totalHitsKey) || 0

  const allSlugs = await kv.smembers('all_slugs')
  const slugStats = []

  for (const slug of allSlugs) {
    const hits = await kv.get(`stats:slug:${slug}:${dateStr}`)
    if (hits) {
      slugStats.push({ slug, hits: Number(hits) })
    }
  }

  // Sort by hits descending
  slugStats.sort((a, b) => b.hits - a.hits)

  const summary = {
    date: dateStr,
    totalHits: Number(totalHits),
    activeSlugsCount: slugStats.length,
    topSlugs: slugStats.slice(0, 5),
    generatedAt: new Date().toISOString()
  }

  // Store summary for history
  await kv.set(`summary:${dateStr}`, JSON.stringify(summary))
  
  // Clean up daily stats (keep them for a week just in case)
  const statsTTL = 7 * 24 * 60 * 60
  await kv.expire(totalHitsKey, statsTTL)
  for (const slug of allSlugs) {
     await kv.expire(`stats:slug:${slug}:${dateStr}`, statsTTL)
  }

  return summary
}

async function processPendingDeletionRequests() {
  const pendingSlugsRaw = await kv.smembers('slug_deletions:pending')
  const pendingSlugs = Array.isArray(pendingSlugsRaw)
    ? pendingSlugsRaw.filter((slug): slug is string => typeof slug === 'string' && slug.length > 0)
    : []

  const processed = []

  for (const slug of pendingSlugs) {
    const deletionRecord = readDeletionRequestRecord(
      await kv.get(`slug:deletion:${slug}`)
    )

    if (!deletionRecord || deletionRecord.status !== 'pending') {
      await kv.srem('slug_deletions:pending', slug)
      continue
    }

    if (!isDeletionRequestEligible(deletionRecord)) {
      continue
    }

    const ownerRaw = await kv.get(`slug:owner:${slug}`)
    const configRaw = await kv.get(`config:${slug}`)
    const rawRequests = await kv.lrange(`requests:${slug}`, 0, -1)

    let owner: { id?: string | null; email?: string | null; createdAt?: string | null } | null =
      null
    if (typeof ownerRaw === 'string') {
      try {
        owner = JSON.parse(ownerRaw)
      } catch {
        owner = null
      }
    } else if (ownerRaw && typeof ownerRaw === 'object') {
      owner = ownerRaw as { id?: string | null; email?: string | null; createdAt?: string | null }
    }

    const archiveKey = `archive:slug:${slug}:${deletionRecord.id}`
    const archivedAt = new Date().toISOString()
    const completedDeletionRecord = {
      ...deletionRecord,
      status: 'completed',
      archivedAt,
      archiveKey,
      updatedAt: archivedAt,
    }
    const archivePayload = {
      slug,
      archivedAt,
      reason: 'user-requested-deletion',
      deletionRequest: sanitizeDeletionRequestForArchive(deletionRecord),
      owner: sanitizeOwnerForArchive(owner),
      config: typeof configRaw === 'string' ? safeParse(configRaw) : configRaw,
      requests: (Array.isArray(rawRequests) ? rawRequests : []).map((item) => {
        if (typeof item === 'string') {
          return safeParse(item)
        }

        return item
      }),
    }

    await Promise.all([
      kv.set(archiveKey, JSON.stringify(archivePayload)),
      kv.set(`deletion_request:${deletionRecord.id}`, JSON.stringify(completedDeletionRecord)),
      kv.sadd('archives:slugs', archiveKey),
      kv.del(`requests:${slug}`),
      kv.del(`config:${slug}`),
      kv.del(`active:${slug}`),
      kv.del(`slug:owner:${slug}`),
      kv.del(`slug:deletion:${slug}`),
      kv.srem('all_slugs', slug),
      kv.srem('slug_deletions:pending', slug),
      owner?.id ? kv.srem(`user_slugs:${owner.id}`, slug) : Promise.resolve(0),
      owner?.email ? kv.srem(`user_slugs:${owner.email}`, slug) : Promise.resolve(0),
      logDeletionAuditEvent({
        type: 'slug-deleted',
        slug,
        requestId: deletionRecord.id,
        requestedAt: deletionRecord.requestedAt,
        deletedAt: archivedAt,
      }),
      publishAdminAlert({
        type: 'slug-deleted',
        slug,
        message: `${slug} was archived and deleted after the 24-hour hold.`,
        metadata: {
          requestId: deletionRecord.id,
          deletedAt: archivedAt,
        },
      }),
    ])

    await anonymizeAdminRequestLogForSlug(slug)

    processed.push({
      slug,
      archiveKey,
      archivedAt,
    })
  }

  return {
    pendingCount: pendingSlugs.length,
    processedCount: processed.length,
    processed,
  }
}

function safeParse(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}
