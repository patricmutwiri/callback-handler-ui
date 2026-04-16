/**
 * Project Name: Callback Handler UI
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

export const FEATURE_REQUEST_REPO = 'patricmutwiri/callback-handler-ui'

export function normalizeEmailAddress(email) {
  return String(email || '').trim().toLowerCase()
}

export function featureRequestUserIndexKey(email) {
  return `feature_requests:user:${normalizeEmailAddress(email)}`
}

export function maskEmailAddress(email) {
  const normalizedEmail = normalizeEmailAddress(email)
  const [localPart, domain] = normalizedEmail.split('@')

  if (!localPart || !domain) {
    return ''
  }

  if (localPart.length <= 2) {
    return `${localPart[0] || ''}***@${domain}`
  }

  if (localPart.length <= 4) {
    return `${localPart[0]}***${localPart.at(-1)}@${domain}`
  }

  return `${localPart.slice(0, 2)}***${localPart.slice(-2)}@${domain}`
}

export function buildFeatureRequestRecord({
  title,
  description,
  requesterName,
  requesterEmail,
}) {
  const now = new Date().toISOString()
  const normalizedRequesterEmail = normalizeEmailAddress(requesterEmail)

  return {
    id: crypto.randomUUID(),
    title,
    description,
    requesterName,
    requesterEmail: normalizedRequesterEmail,
    requesterEmailMasked: maskEmailAddress(normalizedRequesterEmail),
    linkedUserId: null,
    linkedUserEmail: null,
    linkedAt: null,
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

export async function linkFeatureRequestsToUser({ kvClient, user }) {
  const normalizedEmail = normalizeEmailAddress(user?.email)

  if (!normalizedEmail) {
    return { linkedCount: 0 }
  }

  const requestIdsRaw = await kvClient.lrange(featureRequestUserIndexKey(normalizedEmail), 0, -1)
  const requestIds = Array.isArray(requestIdsRaw)
    ? requestIdsRaw.filter((id) => typeof id === 'string' && id.length > 0)
    : []

  if (requestIds.length === 0) {
    return { linkedCount: 0 }
  }

  const recordsRaw = await Promise.all(
    requestIds.map((id) => kvClient.get(`feature_request:${id}`))
  )

  let linkedCount = 0
  const linkedAt = new Date().toISOString()

  await Promise.all(
    recordsRaw.map(async (rawRecord, index) => {
      const record = readFeatureRequestRecord(rawRecord)

      if (!record || normalizeEmailAddress(record.requesterEmail) !== normalizedEmail) {
        return
      }

      if (record.linkedUserEmail === normalizedEmail && record.linkedUserId === user?.id) {
        return
      }

      const updatedRecord = {
        ...record,
        requesterEmailMasked: record.requesterEmailMasked || maskEmailAddress(record.requesterEmail),
        linkedUserId: user?.id ?? null,
        linkedUserEmail: normalizedEmail,
        linkedAt,
        updatedAt: linkedAt,
      }

      linkedCount += 1
      await kvClient.set(`feature_request:${requestIds[index]}`, JSON.stringify(updatedRecord))
    })
  )

  return { linkedCount }
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
    `- Email: ${featureRequest.requesterEmailMasked || maskEmailAddress(featureRequest.requesterEmail)}`,
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
