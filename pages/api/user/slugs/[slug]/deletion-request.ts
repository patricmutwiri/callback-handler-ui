/**
 * Project Name: Callback Handler UI
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

import { kv } from '@vercel/kv'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { logDeletionAuditEvent, publishAdminAlert } from '../../../../../lib/admin-monitoring.mjs'
import { isSlugOwner, readOwnerRecord } from '../../../../../lib/slug-access.mjs'
import { buildDeletionRequestRecord, readDeletionRequestRecord } from '../../../../../lib/slug-deletion.mjs'
import { authOptions } from '../../../auth/[...nextauth]'

type Data =
  | {
      request: {
        id: string
        slug: string
        status: string
        requestedAt: string
        eligibleAfter: string
        reason: string
      }
      alreadyRequested?: boolean
    }
  | { error: string }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)

  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { slug } = req.query
  const reason =
    typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Slug is required' })
  }

  if (!reason || reason.length < 10) {
    return res
      .status(400)
      .json({ error: 'Deletion reason must be at least 10 characters.' })
  }

  try {
    const ownerRaw = await kv.get(`slug:owner:${slug}`)
    const owner = readOwnerRecord(ownerRaw)

    if (!owner || !isSlugOwner(owner, session.user)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const existingRequest = readDeletionRequestRecord(
      await kv.get(`slug:deletion:${slug}`)
    )

    if (existingRequest?.status === 'pending') {
      return res.status(200).json({
        request: {
          id: existingRequest.id,
          slug: existingRequest.slug,
          status: existingRequest.status,
          requestedAt: existingRequest.requestedAt,
          eligibleAfter: existingRequest.eligibleAfter,
          reason: existingRequest.reason,
        },
        alreadyRequested: true,
      })
    }

    const deletionRequest = buildDeletionRequestRecord({
      slug,
      user: session.user,
      reason,
    })

    await Promise.all([
      kv.set(`slug:deletion:${slug}`, JSON.stringify(deletionRequest)),
      kv.set(`deletion_request:${deletionRequest.id}`, JSON.stringify(deletionRequest)),
      kv.sadd('slug_deletions:pending', slug),
      logDeletionAuditEvent({
        type: 'slug-deletion-requested',
        slug,
        requestId: deletionRequest.id,
        requestedAt: deletionRequest.requestedAt,
        eligibleAfter: deletionRequest.eligibleAfter,
        requestedByEmail: session.user.email ?? null,
        reason: deletionRequest.reason,
      }),
      publishAdminAlert({
        type: 'slug-deletion-requested',
        slug,
        message: `Deletion requested for ${slug}. Eligible after 24 hours.`,
        metadata: {
          requestId: deletionRequest.id,
          eligibleAfter: deletionRequest.eligibleAfter,
          reason: deletionRequest.reason,
        },
      }),
    ])
    await kv.lpush('deletion_requests:index', deletionRequest.id)
    await kv.ltrim('deletion_requests:index', 0, 499)

    return res.status(201).json({
      request: {
        id: deletionRequest.id,
        slug: deletionRequest.slug,
        status: deletionRequest.status,
        requestedAt: deletionRequest.requestedAt,
        eligibleAfter: deletionRequest.eligibleAfter,
        reason: deletionRequest.reason,
      },
    })
  } catch (error) {
    console.error('Failed to create slug deletion request:', error)
    return res.status(500).json({ error: 'Failed to create deletion request' })
  }
}
