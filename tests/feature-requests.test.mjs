/**
 * Project Name: WooCommerce Dynamics Sync
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildFeatureRequestRecord,
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
    requesterEmail: 'dev@patric.xyz',
  })

  assert.equal(record.title, 'Better search filters')
  assert.equal(record.status, 'submitted')
  assert.equal(record.githubIssueNumber, null)
  assert.equal(record.requesterEmail, 'dev@patric.xyz')
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
