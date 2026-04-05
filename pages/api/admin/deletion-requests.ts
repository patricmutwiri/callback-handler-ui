/**
 * Project Name: Callback Handler UI
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

import { kv } from '@vercel/kv'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { parseAdminEmails } from '../../../lib/admin-monitoring.mjs'
import { readDeletionRequestRecord } from '../../../lib/slug-deletion.mjs'
import { authOptions } from '../auth/[...nextauth]'

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50

type DeletionRequestRecord = {
  id: string
  slug: string
  status: string
  reason: string
  requestedAt: string
  eligibleAfter: string
  archivedAt?: string | null
  archiveKey?: string | null
  requestedBy?: {
    email?: string | null
    name?: string | null
  }
}

type Data =
  | {
      requests: DeletionRequestRecord[]
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
  const sessionEmail = session?.user?.email?.toLowerCase() || ''
  const adminEmails = parseAdminEmails()

  if (!sessionEmail || !adminEmails.includes(sessionEmail)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1)
  const requestedPageSize =
    Number.parseInt(String(req.query.pageSize || DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requestedPageSize))
  const start = (page - 1) * pageSize
  const end = start + pageSize - 1

  try {
    const [requestIdsRaw, totalItemsRaw] = await Promise.all([
      kv.lrange('deletion_requests:index', start, end),
      kv.llen('deletion_requests:index'),
    ])

    const requestIds = Array.isArray(requestIdsRaw)
      ? requestIdsRaw.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : []

    const recordsRaw = await Promise.all(
      requestIds.map((id) => kv.get(`deletion_request:${id}`))
    )

    const requests = recordsRaw
      .map((item) => readDeletionRequestRecord(item))
      .filter(Boolean) as DeletionRequestRecord[]

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
    console.error('Failed to load deletion requests:', error)
    return res.status(500).json({ error: 'Failed to load deletion requests' })
  }
}
