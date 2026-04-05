/**
 * Project Name: Callback Handler UI
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

import { kv } from '@vercel/kv'
import type { NextApiRequest, NextApiResponse } from 'next'
import { createGithubIssueForFeatureRequest, buildFeatureRequestRecord, validateFeatureRequestInput } from '../../lib/feature-requests.mjs'
import { publishAdminAlert } from '../../lib/admin-monitoring.mjs'

type Data =
  | {
      request: {
        id: string
        title: string
        status: string
        githubIssueNumber: number | null
        githubIssueUrl: string | null
      }
    }
  | { error: string }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
  const description =
    typeof req.body?.description === 'string' ? req.body.description.trim() : ''
  const requesterName =
    typeof req.body?.requesterName === 'string' ? req.body.requesterName.trim() : ''
  const requesterEmail =
    typeof req.body?.requesterEmail === 'string' ? req.body.requesterEmail.trim() : ''

  const validationError = validateFeatureRequestInput({
    title,
    description,
    requesterName,
    requesterEmail,
  })

  if (validationError) {
    return res.status(400).json({ error: validationError })
  }

  try {
    const featureRequest = buildFeatureRequestRecord({
      title,
      description,
      requesterName,
      requesterEmail,
    })

    const issue = await createGithubIssueForFeatureRequest(featureRequest)

    const storedRequest = {
      ...featureRequest,
      githubIssueNumber: issue.number,
      githubIssueUrl: issue.url,
      githubIssueState: issue.state,
      status: 'open',
      updatedAt: new Date().toISOString(),
    }

    await Promise.all([
      kv.set(`feature_request:${storedRequest.id}`, JSON.stringify(storedRequest)),
      kv.set(`feature_request_issue:${issue.number}`, storedRequest.id),
      publishAdminAlert({
        type: 'feature-request-created',
        slug: storedRequest.id,
        message: `Feature request "${storedRequest.title}" was submitted and opened as GitHub issue #${issue.number}.`,
        metadata: {
          requestId: storedRequest.id,
          issueNumber: issue.number,
        },
      }),
    ])
    await kv.lpush('feature_requests:index', storedRequest.id)
    await kv.ltrim('feature_requests:index', 0, 499)

    return res.status(201).json({
      request: {
        id: storedRequest.id,
        title: storedRequest.title,
        status: storedRequest.status,
        githubIssueNumber: storedRequest.githubIssueNumber,
        githubIssueUrl: storedRequest.githubIssueUrl,
      },
    })
  } catch (error) {
    console.error('Failed to create feature request:', error)
    return res.status(500).json({ error: 'Failed to create feature request' })
  }
}
