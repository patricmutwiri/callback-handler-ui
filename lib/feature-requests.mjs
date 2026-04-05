/**
 * Project Name: Callback Handler UI
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

export const FEATURE_REQUEST_REPO = 'patricmutwiri/callback-handler-ui'

export function buildFeatureRequestRecord({
  title,
  description,
  requesterName,
  requesterEmail,
}) {
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    title,
    description,
    requesterName,
    requesterEmail,
    status: 'submitted',
    adminResponse: '',
    githubIssueNumber: null,
    githubIssueUrl: null,
    githubIssueState: 'open',
    createdAt: now,
    updatedAt: now,
    closedAt: null,
  }
}

export function readFeatureRequestRecord(rawValue) {
  if (!rawValue) {
    return null
  }

  return typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue
}

export function validateFeatureRequestInput({
  title,
  description,
  requesterName,
  requesterEmail,
}) {
  if (!title || title.trim().length < 6) {
    return 'Feature title must be at least 6 characters.'
  }

  if (!description || description.trim().length < 20) {
    return 'Feature details must be at least 20 characters.'
  }

  if (!requesterName || requesterName.trim().length < 2) {
    return 'Your name must be at least 2 characters.'
  }

  const email = requesterEmail?.trim()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'A valid requester email is required.'
  }

  return null
}

export async function createGithubIssueForFeatureRequest(featureRequest) {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('Missing GITHUB_TOKEN')
  }

  const issueBody = [
    '## Feature request',
    '',
    featureRequest.description,
    '',
    '## Requester',
    '',
    `- Name: ${featureRequest.requesterName}`,
    `- Email: ${featureRequest.requesterEmail}`,
    `- Submitted at: ${featureRequest.createdAt}`,
    '',
    '## Internal tracking',
    '',
    `- Feature request id: ${featureRequest.id}`,
  ].join('\n')

  const response = await fetch(
    `https://api.github.com/repos/${FEATURE_REQUEST_REPO}/issues`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'callback-handler-ui',
      },
      body: JSON.stringify({
        title: `[Feature Request] ${featureRequest.title}`,
        body: issueBody,
      }),
    }
  )

  if (!response.ok) {
    const responseText = await response.text()
    throw new Error(`GitHub issue creation failed: ${response.status} ${responseText}`)
  }

  const issue = await response.json()

  return {
    number: issue.number,
    url: issue.html_url,
    state: issue.state,
  }
}
