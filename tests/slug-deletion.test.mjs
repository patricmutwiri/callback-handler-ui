/**
 * Project Name: WooCommerce Dynamics Sync
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DELETION_HOLD_MS,
  buildDeletionRequestRecord,
  isDeletionRequestEligible,
  readDeletionRequestRecord,
  sanitizeDeletionRequestForArchive,
  sanitizeOwnerForArchive,
} from '../lib/slug-deletion.mjs'

test('buildDeletionRequestRecord sets a 24-hour hold window', () => {
  const now = new Date('2026-04-05T10:00:00.000Z')
  const record = buildDeletionRequestRecord({
    slug: 'demo-slug',
    user: {
      id: 'user-1',
      email: 'owner@example.com',
      name: 'Owner',
    },
    reason: 'No longer needed for this integration test.',
    now,
  })

  assert.equal(record.slug, 'demo-slug')
  assert.equal(record.status, 'pending')
  assert.equal(record.reason, 'No longer needed for this integration test.')
  assert.equal(record.requestedAt, '2026-04-05T10:00:00.000Z')
  assert.equal(
    record.eligibleAfter,
    new Date(now.getTime() + DELETION_HOLD_MS).toISOString()
  )
})

test('isDeletionRequestEligible only returns true after the hold window', () => {
  const record = {
    eligibleAfter: '2026-04-06T10:00:00.000Z',
  }

  assert.equal(
    isDeletionRequestEligible(record, new Date('2026-04-06T09:59:59.000Z')),
    false
  )
  assert.equal(
    isDeletionRequestEligible(record, new Date('2026-04-06T10:00:00.000Z')),
    true
  )
})

test('readDeletionRequestRecord parses serialized JSON records', () => {
  const parsed = readDeletionRequestRecord(
    '{"slug":"demo-slug","status":"pending"}'
  )

  assert.deepEqual(parsed, {
    slug: 'demo-slug',
    status: 'pending',
  })
})

test('archive sanitizers remove user identifiers while preserving audit timing', () => {
  assert.deepEqual(
    sanitizeOwnerForArchive({
      id: 'owner-1',
      email: 'owner@example.com',
      createdAt: '2026-04-05T10:00:00.000Z',
    }),
    {
      createdAt: '2026-04-05T10:00:00.000Z',
      anonymized: true,
    }
  )

  assert.deepEqual(
    sanitizeDeletionRequestForArchive({
      id: 'request-1',
      slug: 'demo-slug',
      status: 'pending',
      requestedAt: '2026-04-05T10:00:00.000Z',
      eligibleAfter: '2026-04-06T10:00:00.000Z',
      reason: 'No longer needed after migration.',
      requestedBy: {
        id: 'owner-1',
        email: 'owner@example.com',
      },
    }),
    {
      id: 'request-1',
      slug: 'demo-slug',
      status: 'pending',
      requestedAt: '2026-04-05T10:00:00.000Z',
      eligibleAfter: '2026-04-06T10:00:00.000Z',
      reason: 'No longer needed after migration.',
      requestedBy: {
        anonymized: true,
      },
    }
  )
})
