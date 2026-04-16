/**
 * Project Name: Callback Handler UI
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

import { kv } from '@vercel/kv'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import {
  featureRequestUserIndexKey,
  normalizeEmailAddress,
  readFeatureRequestRecord,
} from '../../../lib/feature-requests.mjs'
import { authOptions } from '../auth/[...nextauth]'

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50

type FeatureRequestRecord = {
  id: string
  title: string
  description: string
  requesterName: string
  requesterEmail: string
  status: string
  adminResponse: string
  githubIssueNumber: number | null
  githubIssueUrl: string | null
  githubIssueState: string
  createdAt: string
  updatedAt: string
  closedAt: string | null
}

type Data =
  | {
      requests: FeatureRequestRecord[]
      pagination: {
        page: number
        pageSize: number
        totalItems: number
        totalPages: number
      }
    }
  | { error: string }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  const sessionEmail = normalizeEmailAddress(session?.user?.email)

  if (!sessionEmail) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1)
  const requestedPageSize =
    Number.parseInt(String(req.query.pageSize || DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requestedPageSize))
  const start = (page - 1) * pageSize
  const end = start + pageSize - 1
  const userIndexKey = featureRequestUserIndexKey(sessionEmail)

  try {
    const [requestIdsRaw, totalItemsRaw] = await Promise.all([
      kv.lrange(userIndexKey, start, end),
      kv.llen(userIndexKey),
    ])

    const requestIds = Array.isArray(requestIdsRaw)
      ? requestIdsRaw.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : []

    const recordsRaw = await Promise.all(
      requestIds.map((id) => kv.get(`feature_request:${id}`))
    )

    const requests = recordsRaw
      .map((item) => readFeatureRequestRecord(item))
      .filter((item): item is FeatureRequestRecord => {
        return Boolean(
            item &&
            typeof item === 'object' &&
            typeof item.requesterEmail === 'string' &&
            (normalizeEmailAddress(item.requesterEmail) === sessionEmail ||
              normalizeEmailAddress(item.linkedUserEmail) === sessionEmail)
        )
      })

    const totalItems = Number(totalItemsRaw || 0)
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 1

    return res.status(200).json({
      requests,
      pagination: {
        page: Math.min(page, totalPages),
        pageSize,
        totalItems,
        totalPages,
      },
    })
  } catch (error) {
    console.error('Failed to load user feature requests:', error)
    return res.status(500).json({ error: 'Failed to load feature requests' })
  }
}
