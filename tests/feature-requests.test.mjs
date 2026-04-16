/**
 * Project Name: Callback Handler UI
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildFeatureRequestRecord,
  createGithubIssueForFeatureRequest,
  featureRequestUserIndexKey,
  linkFeatureRequestsToUser,
  maskEmailAddress,
  normalizeEmailAddress,
  readFeatureRequestRecord,
  validateFeatureRequestInput,
} from '../lib/feature-requests.mjs'

test('validateFeatureRequestInput rejects incomplete requests and accepts valid payloads', () => {
  assert.equal(
    validateFeatureRequestInput({
      title: 'Short',
      description: 'Too short',
      requesterName: 'P',
      requesterEmail: 'bad-email',
    }),
    'Feature title must be at least 6 characters.'
  )

  assert.equal(
    validateFeatureRequestInput({
      title: 'Better search filters',
      description: 'Please add saved filters and pinned filter sets for repeated investigations.',
      requesterName: 'Patrick',
      requesterEmail: 'dev@patric.xyz',
    }),
    null
  )
})

test('buildFeatureRequestRecord creates a persisted review record', () => {
  const record = buildFeatureRequestRecord({
    title: 'Better search filters',
    description: 'Please add saved filters and pinned filter sets for repeated investigations.',
    requesterName: 'Patrick',
    requesterEmail: 'Dev@Patric.xyz',
  })

  assert.equal(record.title, 'Better search filters')
  assert.equal(record.status, 'submitted')
  assert.equal(record.githubIssueNumber, null)
  assert.equal(record.requesterEmail, 'dev@patric.xyz')
  assert.equal(record.requesterEmailMasked, 'd***v@patric.xyz')
  assert.equal(record.linkedUserEmail, null)
})

test('readFeatureRequestRecord parses serialized feature request records', () => {
  assert.deepEqual(
    readFeatureRequestRecord('{"id":"req-1","title":"Test"}'),
    {
      id: 'req-1',
      title: 'Test',
    }
  )
})

test('maskEmailAddress hides the local part while preserving routing context', () => {
  assert.equal(maskEmailAddress('emailtest@gmail.com'), 'em***st@gmail.com')
  assert.equal(maskEmailAddress('ab@example.com'), 'a***@example.com')
  assert.equal(maskEmailAddress(''), '')
})

test('feature request user index keys normalize requester emails', () => {
  assert.equal(normalizeEmailAddress(' Dev@Patric.xyz '), 'dev@patric.xyz')
  assert.equal(featureRequestUserIndexKey(' Dev@Patric.xyz '), 'feature_requests:user:dev@patric.xyz')
})

test('linkFeatureRequestsToUser relates matching requester emails after sign-in', async () => {
  const storedRecords = new Map()
  const emailIndexKey = featureRequestUserIndexKey('dev@patric.xyz')
  const kvClient = {
    async lrange(key) {
      assert.equal(key, emailIndexKey)
      return ['req-1', 'req-2']
    },
    async get(key) {
      return storedRecords.get(key) ?? null
    },
    async set(key, value) {
      storedRecords.set(key, value)
    },
  }

  storedRecords.set(
    'feature_request:req-1',
    JSON.stringify({
      id: 'req-1',
      requesterEmail: 'dev@patric.xyz',
      requesterEmailMasked: 'd***v@patric.xyz',
      updatedAt: '2026-04-05T00:00:00.000Z',
    })
  )
  storedRecords.set(
    'feature_request:req-2',
    JSON.stringify({
      id: 'req-2',
      requesterEmail: 'other@example.com',
      updatedAt: '2026-04-05T00:00:00.000Z',
    })
  )

  const result = await linkFeatureRequestsToUser({
    kvClient,
    user: {
      id: 'user-1',
      email: 'Dev@Patric.xyz',
    },
  })

  const linkedRecord = JSON.parse(storedRecords.get('feature_request:req-1'))

  assert.equal(result.linkedCount, 1)
  assert.equal(linkedRecord.linkedUserId, 'user-1')
  assert.equal(linkedRecord.linkedUserEmail, 'dev@patric.xyz')
  assert.equal(linkedRecord.requesterEmailMasked, 'd***v@patric.xyz')
  assert.equal(typeof linkedRecord.linkedAt, 'string')
})

test('createGithubIssueForFeatureRequest sends masked requester email to GitHub', async () => {
  const originalToken = process.env.GITHUB_TOKEN
  const originalFetch = globalThis.fetch
  let postedBody = null

  process.env.GITHUB_TOKEN = 'test-token'
  globalThis.fetch = async (_url, init) => {
    postedBody = JSON.parse(init.body)
    return {
      ok: true,
      async json() {
        return {
          number: 123,
          html_url: 'https://github.com/patricmutwiri/callback-handler-ui/issues/123',
          state: 'open',
        }
      },
    }
  }

  try {
    const featureRequest = buildFeatureRequestRecord({
      title: 'Better search filters',
      description: 'Please add saved filters and pinned filter sets for repeated investigations.',
      requesterName: 'Patrick',
      requesterEmail: 'emailtest@gmail.com',
    })

    await createGithubIssueForFeatureRequest(featureRequest)

    assert.match(postedBody.body, /Email: em\*\*\*st@gmail\.com/)
    assert.doesNotMatch(postedBody.body, /emailtest@gmail\.com/)
  } finally {
    globalThis.fetch = originalFetch

    if (originalToken === undefined) {
      delete process.env.GITHUB_TOKEN
    } else {
      process.env.GITHUB_TOKEN = originalToken
    }
  }
})
