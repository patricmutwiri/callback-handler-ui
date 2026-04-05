/**
 * Project Name: Callback Handler UI
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canAccessSlugConfig,
  getRecordAccessDecision,
  hasSlugCookieAccess,
  isSlugOwner,
  parseCookies,
  readOwnerRecord,
} from '../lib/slug-access.mjs'

test('parseCookies decodes simple cookie headers', () => {
  assert.deepEqual(parseCookies('a=1; slug_creator_demo=hello%20world'), {
    a: '1',
    slug_creator_demo: 'hello world',
  })
})

test('hasSlugCookieAccess detects the browser ownership cookie', () => {
  assert.equal(hasSlugCookieAccess('foo=bar; slug_creator_demo=1', 'demo'), true)
  assert.equal(hasSlugCookieAccess('foo=bar', 'demo'), false)
})

test('readOwnerRecord parses string and object records', () => {
  assert.deepEqual(readOwnerRecord('{"id":"123","email":"owner@example.com"}'), {
    id: '123',
    email: 'owner@example.com',
  })
  assert.deepEqual(readOwnerRecord({ id: '123' }), { id: '123' })
  assert.equal(readOwnerRecord(null), null)
})

test('readOwnerRecord throws on invalid JSON', () => {
  assert.throws(() => readOwnerRecord('{bad json}'))
})

test('isSlugOwner prefers id matches and falls back to case-insensitive email', () => {
  assert.equal(
    isSlugOwner({ id: 'user-1', email: 'owner@example.com' }, { id: 'user-1', email: 'other@example.com' }),
    true
  )
  assert.equal(
    isSlugOwner({ email: 'Owner@Example.com' }, { email: 'owner@example.com' }),
    true
  )
  assert.equal(
    isSlugOwner({ id: 'user-1', email: 'owner@example.com' }, { id: 'user-2', email: 'other@example.com' }),
    false
  )
})

test('canAccessSlugConfig allows cookie-backed access without a session', () => {
  assert.equal(
    canAccessSlugConfig({
      slug: 'demo',
      cookieHeader: 'slug_creator_demo=1',
      sessionUser: null,
      owner: null,
    }),
    true
  )
})

test('canAccessSlugConfig allows the owner by id or email and rejects others', () => {
  assert.equal(
    canAccessSlugConfig({
      slug: 'demo',
      cookieHeader: '',
      sessionUser: { id: 'owner-1', email: 'owner@example.com' },
      owner: { id: 'owner-1', email: 'owner@example.com' },
    }),
    true
  )

  assert.equal(
    canAccessSlugConfig({
      slug: 'demo',
      cookieHeader: '',
      sessionUser: { email: 'OWNER@example.com' },
      owner: { email: 'owner@example.com' },
    }),
    true
  )

  assert.equal(
    canAccessSlugConfig({
      slug: 'demo',
      cookieHeader: '',
      sessionUser: { id: 'intruder' },
      owner: { id: 'owner-1' },
    }),
    false
  )
})

test('getRecordAccessDecision returns 401 when neither session nor browser cookie is present', () => {
  assert.deepEqual(
    getRecordAccessDecision({
      slug: 'demo',
      cookieHeader: '',
      sessionUser: null,
      owner: null,
    }),
    { authorized: false, status: 401, via: 'none' }
  )
})

test('getRecordAccessDecision allows cookie override for anonymous browser-created slugs', () => {
  assert.deepEqual(
    getRecordAccessDecision({
      slug: 'demo',
      cookieHeader: 'slug_creator_demo=1',
      sessionUser: null,
      owner: null,
    }),
    { authorized: true, status: 200, via: 'cookie' }
  )
})

test('getRecordAccessDecision allows the signed-in owner', () => {
  assert.deepEqual(
    getRecordAccessDecision({
      slug: 'demo',
      cookieHeader: '',
      sessionUser: { id: 'owner-1', email: 'owner@example.com' },
      owner: { id: 'owner-1', email: 'owner@example.com' },
    }),
    { authorized: true, status: 200, via: 'owner' }
  )
})

test('getRecordAccessDecision rejects signed-in non-owners and missing owners with 403', () => {
  assert.deepEqual(
    getRecordAccessDecision({
      slug: 'demo',
      cookieHeader: '',
      sessionUser: { id: 'intruder', email: 'intruder@example.com' },
      owner: { id: 'owner-1', email: 'owner@example.com' },
    }),
    { authorized: false, status: 403, via: 'session' }
  )

  assert.deepEqual(
    getRecordAccessDecision({
      slug: 'demo',
      cookieHeader: 'slug_creator_demo=1',
      sessionUser: { id: 'intruder', email: 'intruder@example.com' },
      owner: null,
    }),
    { authorized: false, status: 403, via: 'session' }
  )
})
