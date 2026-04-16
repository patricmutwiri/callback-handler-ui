import { kv } from '@vercel/kv'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import {
  getSlugUserIndexKeys,
  isSlugOwner,
  readOwnerRecord,
} from '../../../lib/slug-access.mjs'
import { authOptions } from '../auth/[...nextauth]'

interface UserSlug {
  slug: string
  createdAt: string | null
  deletionRequestedAt: string | null
  deletionEligibleAfter: string | null
  deletionStatus: 'pending' | 'none'
  deletionReason: string | null
}

type Data =
  | { slugs: UserSlug[] }
  | { error: string }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)

  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const userIndexKeys = getSlugUserIndexKeys(session.user)

  if (userIndexKeys.length === 0) {
    return res.status(400).json({ error: 'User identifier not found' })
  }

  try {
    const indexedSlugGroups = await Promise.all(
      userIndexKeys.map((key) => kv.smembers(key) as Promise<unknown>)
    )
    const indexedSlugs = indexedSlugGroups.flatMap((rawSlugs) => {
      return Array.isArray(rawSlugs)
        ? rawSlugs.filter(
            (slug): slug is string => typeof slug === 'string' && slug.trim().length > 0
          )
        : []
    })
    const allKnownSlugs = await kv.smembers('all_slugs') as unknown
    const candidateSlugs = new Set(indexedSlugs)

    if (Array.isArray(allKnownSlugs)) {
      for (const slug of allKnownSlugs) {
        if (typeof slug === 'string' && slug.trim()) {
          candidateSlugs.add(slug)
        }
      }
    }

    const slugsWithMeta: Array<UserSlug | null> = await Promise.all(
      Array.from(candidateSlugs).map(async (slug) => {
        try {
          const ownerRaw = await kv.get(`slug:owner:${slug}`)
          const deletionRaw = await kv.get(`slug:deletion:${slug}`)
          let deletion = null

          if (typeof deletionRaw === 'string') {
            try {
              deletion = JSON.parse(deletionRaw)
            } catch {
              deletion = null
            }
          } else {
            deletion = deletionRaw
          }

          const owner = readOwnerRecord(ownerRaw)

          if (!owner || !isSlugOwner(owner, session.user)) {
            return null
          }

          const createdAt =
            owner && typeof owner === 'object' && typeof owner.createdAt === 'string'
              ? owner.createdAt
              : null

          return {
            slug,
            createdAt,
            deletionRequestedAt: deletion?.requestedAt ?? null,
            deletionEligibleAfter: deletion?.eligibleAfter ?? null,
            deletionStatus: deletion?.status === 'pending' ? 'pending' : 'none',
            deletionReason: deletion?.reason ?? null,
          }
        } catch {
          return null
        }
      })
    )
    const ownedSlugsWithMeta = slugsWithMeta.filter(
      (item): item is UserSlug => Boolean(item)
    )

    if (ownedSlugsWithMeta.length > 0) {
      await Promise.all(
        userIndexKeys.flatMap((indexKey) =>
          ownedSlugsWithMeta.map((item) => kv.sadd(indexKey, item.slug))
        )
      )
    }

    // Sort by newest first when we have dates, otherwise by slug
    ownedSlugsWithMeta.sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
      if (a.createdAt && !b.createdAt) return -1
      if (!a.createdAt && b.createdAt) return 1
      return a.slug.localeCompare(b.slug)
    })

    return res.status(200).json({ slugs: ownedSlugsWithMeta })
  } catch (error) {
    console.error('Failed to load user slugs:', error)
    return res.status(500).json({ error: 'Failed to load user slugs' })
  }
}
