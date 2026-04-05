/**
 * Project Name: WooCommerce Dynamics Sync
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

import { kv } from '@vercel/kv'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'

interface AdminUsageRequest {
  id: string
  slug: string
  timestamp: string
  method: string
  ip: string
  responseStatus?: number
  accessType: 'guest' | 'authenticated'
  ownerEmail?: string | null
}

type Data =
  | {
      stats: {
        totalRequests: number
        guestRequests: number
        authenticatedRequests: number
        uniqueSlugs: number
      }
      recentRequests: AdminUsageRequest[]
    }
  | { error: string }

const parseAdminEmails = () => {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

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

  try {
    const [rawRecentRequests, totalRequests, guestRequests, authenticatedRequests, uniqueSlugs] =
      await Promise.all([
        kv.lrange('admin:requests', 0, 24),
        kv.get<number>('stats:requests:all-time'),
        kv.get<number>('stats:requests:guest'),
        kv.get<number>('stats:requests:authenticated'),
        kv.scard('all_slugs'),
      ])

    const recentRequests = (Array.isArray(rawRecentRequests) ? rawRecentRequests : [])
      .map((item) => {
        if (!item) return null

        if (typeof item === 'object') {
          return item as AdminUsageRequest
        }

        try {
          return JSON.parse(item as string) as AdminUsageRequest
        } catch {
          return null
        }
      })
      .filter(Boolean) as AdminUsageRequest[]

    return res.status(200).json({
      stats: {
        totalRequests: Number(totalRequests || 0),
        guestRequests: Number(guestRequests || 0),
        authenticatedRequests: Number(authenticatedRequests || 0),
        uniqueSlugs: Number(uniqueSlugs || 0),
      },
      recentRequests,
    })
  } catch (error) {
    console.error('Failed to load admin usage:', error)
    return res.status(500).json({ error: 'Failed to load admin usage' })
  }
}
