import { kv } from '@vercel/kv'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'

interface UserSlug {
  slug: string
  createdAt: string | null
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

  const userId = (session.user.id as string | null) ?? session.user.email ?? null

  if (!userId) {
    return res.status(400).json({ error: 'User identifier not found' })
  }

  try {
    const key = `user_slugs:${userId}`
    const rawSlugs = (await kv.smembers(key)) as unknown
    const cleanedSlugs = Array.isArray(rawSlugs)
      ? rawSlugs.filter(
          (s): s is string => typeof s === 'string' && s.trim().length > 0
        )
      : []

    const slugsWithMeta: UserSlug[] = await Promise.all(
      cleanedSlugs.map(async (slug) => {
        try {
          const ownerRaw = await kv.get(`slug:owner:${slug}`)
          if (!ownerRaw) {
            return { slug, createdAt: null }
          }

          let owner: any = ownerRaw
          if (typeof ownerRaw === 'string') {
            try {
              owner = JSON.parse(ownerRaw)
            } catch {
              owner = null
            }
          }

          const createdAt =
            owner && typeof owner === 'object' && typeof owner.createdAt === 'string'
              ? owner.createdAt
              : null

          return { slug, createdAt }
        } catch {
          return { slug, createdAt: null }
        }
      })
    )

    // Sort by newest first when we have dates, otherwise by slug
    slugsWithMeta.sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
      if (a.createdAt && !b.createdAt) return -1
      if (!a.createdAt && b.createdAt) return 1
      return a.slug.localeCompare(b.slug)
    })

    return res.status(200).json({ slugs: slugsWithMeta })
  } catch (error) {
    console.error('Failed to load user slugs:', error)
    return res.status(500).json({ error: 'Failed to load user slugs' })
  }
}
