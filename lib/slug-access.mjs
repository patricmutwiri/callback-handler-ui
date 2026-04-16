/**
 * Project Name: Callback Handler UI
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

export const SLUG_RETENTION_SECONDS = 365 * 24 * 60 * 60

export function parseCookies(cookieHeader) {
  const cookies = {}

  if (!cookieHeader) {
    return cookies
  }

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = part.split('=')
    const name = rawName?.trim()

    if (!name) {
      continue
    }

    cookies[name] = decodeURIComponent(rawValue.join('=').trim())
  }

  return cookies
}

export function hasSlugCookieAccess(cookieHeader, slug) {
  const cookies = parseCookies(cookieHeader)
  return Boolean(cookies[`slug_creator_${slug}`])
}

export function readOwnerRecord(ownerRaw) {
  if (!ownerRaw) {
    return null
  }

  return typeof ownerRaw === 'string' ? JSON.parse(ownerRaw) : ownerRaw
}

export function isSlugOwner(owner, sessionUser) {
  const sessionId = sessionUser?.id ?? null
  const sessionEmail = sessionUser?.email ?? null
  const ownerId = owner?.id ?? null
  const ownerEmail = owner?.email ?? null

  if (ownerId && sessionId && String(ownerId) === String(sessionId)) {
    return true
  }

  if (ownerEmail && sessionEmail) {
    return ownerEmail.toLowerCase() === sessionEmail.toLowerCase()
  }

  return false
}

export function canAccessSlugConfig({ slug, cookieHeader, sessionUser, owner }) {
  if (hasSlugCookieAccess(cookieHeader, slug)) {
    return true
  }

  if (!sessionUser || !owner) {
    return false
  }

  return isSlugOwner(owner, sessionUser)
}

export function getRecordAccessDecision({ slug, cookieHeader, sessionUser, owner }) {
  if (!sessionUser) {
    if (hasSlugCookieAccess(cookieHeader, slug)) {
      return { authorized: true, status: 200, via: 'cookie' }
    }

    return { authorized: false, status: 401, via: 'none' }
  }

  if (!owner) {
    return { authorized: false, status: 403, via: 'session' }
  }

  if (isSlugOwner(owner, sessionUser)) {
    return { authorized: true, status: 200, via: 'owner' }
  }

  return { authorized: false, status: 403, via: 'session' }
}

export function getGuestRequestViewLimit() {
  const rawValue = Number.parseInt(process.env.GUEST_REQUEST_VIEW_LIMIT || '5', 10)

  if (Number.isNaN(rawValue) || rawValue < 1) {
    return 5
  }

  return rawValue
}
