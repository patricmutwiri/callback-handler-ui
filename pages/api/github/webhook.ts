/**
 * Project Name: WooCommerce Dynamics Sync
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

import { createHmac, timingSafeEqual } from 'crypto'
import { kv } from '@vercel/kv'
import type { NextApiRequest, NextApiResponse } from 'next'
import { publishAdminAlert } from '../../../lib/admin-monitoring.mjs'
import { readFeatureRequestRecord } from '../../../lib/feature-requests.mjs'
import { sendEmail } from '../../../lib/outbound-email.mjs'

type Data = { ok: true } | { error: string }

export const config = {
  api: {
    bodyParser: false,
  },
}

async function readRawBody(req: NextApiRequest) {
  const chunks: Buffer[] = []

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}

function verifyGithubSignature(body: Buffer, signatureHeader?: string) {
  if (!process.env.GITHUB_WEBHOOK_SECRET || !signatureHeader) {
    return false
  }

  const expectedSignature = `sha256=${createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
    .update(body)
    .digest('hex')}`

  const actual = Buffer.from(signatureHeader)
  const expected = Buffer.from(expectedSignature)

  if (actual.length !== expected.length) {
    return false
  }

  return timingSafeEqual(actual, expected)
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const rawBody = await readRawBody(req)
    const signatureHeader = req.headers['x-hub-signature-256']

    if (
      !verifyGithubSignature(
        rawBody,
        typeof signatureHeader === 'string' ? signatureHeader : undefined
      )
    ) {
      return res.status(401).json({ error: 'Invalid signature' })
    }

    const eventType = req.headers['x-github-event']
    const payload = JSON.parse(rawBody.toString('utf8'))

    if (eventType !== 'issues' || payload.action !== 'closed') {
      return res.status(200).json({ ok: true })
    }

    const issueNumber = payload.issue?.number

    if (!issueNumber) {
      return res.status(200).json({ ok: true })
    }

    const featureRequestId = await kv.get(`feature_request_issue:${issueNumber}`)

    if (!featureRequestId || typeof featureRequestId !== 'string') {
      return res.status(200).json({ ok: true })
    }

    const currentRequest = readFeatureRequestRecord(
      await kv.get(`feature_request:${featureRequestId}`)
    )

    if (!currentRequest) {
      return res.status(200).json({ ok: true })
    }

    const closedAt = payload.issue?.closed_at || new Date().toISOString()
    const updatedRequest = {
      ...currentRequest,
      status: 'closed',
      githubIssueState: 'closed',
      closedAt,
      updatedAt: closedAt,
    }

    await kv.set(`feature_request:${featureRequestId}`, JSON.stringify(updatedRequest))

    await publishAdminAlert({
      type: 'feature-request-closed',
      slug: featureRequestId,
      message: `Feature request "${updatedRequest.title}" was closed on GitHub.`,
      metadata: {
        requestId: featureRequestId,
        issueNumber,
      },
    })

    try {
      await sendEmail({
        to: updatedRequest.requesterEmail,
        subject: `Feature request update: ${updatedRequest.title}`,
        html: `
          <p>Hello ${updatedRequest.requesterName},</p>
          <p>Your feature request <strong>${updatedRequest.title}</strong> has been updated.</p>
          <p>Current status: <strong>Closed</strong></p>
          <p>GitHub issue: <a href="${updatedRequest.githubIssueUrl}">#${updatedRequest.githubIssueNumber}</a></p>
          ${updatedRequest.adminResponse ? `<p>Admin response: ${updatedRequest.adminResponse}</p>` : ''}
        `,
        text: [
          `Hello ${updatedRequest.requesterName},`,
          '',
          `Your feature request "${updatedRequest.title}" has been updated.`,
          'Current status: Closed',
          `GitHub issue: #${updatedRequest.githubIssueNumber} ${updatedRequest.githubIssueUrl || ''}`,
          updatedRequest.adminResponse
            ? `Admin response: ${updatedRequest.adminResponse}`
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
      })
    } catch (emailError) {
      console.error('Failed to send feature request closure email:', emailError)
      await publishAdminAlert({
        type: 'feature-request-email-failed',
        slug: featureRequestId,
        message: `Feature request "${updatedRequest.title}" closed, but the requester email could not be sent.`,
        metadata: {
          requestId: featureRequestId,
          issueNumber,
        },
      })
    }

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Failed to process GitHub webhook:', error)
    return res.status(500).json({ error: 'Failed to process webhook' })
  }
}
