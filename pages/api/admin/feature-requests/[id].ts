/**
 * Project Name: WooCommerce Dynamics Sync
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

import { kv } from '@vercel/kv'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { parseAdminEmails, publishAdminAlert } from '../../../../lib/admin-monitoring.mjs'
import { readFeatureRequestRecord } from '../../../../lib/feature-requests.mjs'
import { authOptions } from '../../auth/[...nextauth]'

type Data =
  | {
      request: {
        id: string
        status: string
        adminResponse: string
        updatedAt: string
      }
    }
  | { error: string }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  const sessionEmail = session?.user?.email?.toLowerCase() || ''
  const adminEmails = parseAdminEmails()

  if (!sessionEmail || !adminEmails.includes(sessionEmail)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Request id is required' })
  }

  const status = typeof req.body?.status === 'string' ? req.body.status.trim() : ''
  const adminResponse =
    typeof req.body?.adminResponse === 'string' ? req.body.adminResponse.trim() : ''

  if (!status) {
    return res.status(400).json({ error: 'Status is required' })
  }

  try {
    const currentRequest = readFeatureRequestRecord(
      await kv.get(`feature_request:${id}`)
    )

    if (!currentRequest) {
      return res.status(404).json({ error: 'Feature request not found' })
    }

    const updatedRequest = {
      ...currentRequest,
      status,
      adminResponse,
      updatedAt: new Date().toISOString(),
    }

    await Promise.all([
      kv.set(`feature_request:${id}`, JSON.stringify(updatedRequest)),
      publishAdminAlert({
        type: 'feature-request-updated',
        slug: id,
        message: `Feature request "${updatedRequest.title}" was updated to ${status}.`,
        metadata: {
          requestId: id,
          status,
        },
      }),
    ])

    return res.status(200).json({
      request: {
        id: updatedRequest.id,
        status: updatedRequest.status,
        adminResponse: updatedRequest.adminResponse,
        updatedAt: updatedRequest.updatedAt,
      },
    })
  } catch (error) {
    console.error('Failed to update feature request:', error)
    return res.status(500).json({ error: 'Failed to update feature request' })
  }
}
