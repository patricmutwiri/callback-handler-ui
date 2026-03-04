import { kv } from '@vercel/kv'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'

type Data =
  | { slugs: string[] }
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
    const rawSlugs = await kv.smembers<string>(key)
    const slugs = Array.isArray(rawSlugs)
      ? rawSlugs
          .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
          .sort((a, b) => a.localeCompare(b))
      : []

    return res.status(200).json({ slugs })
  } catch (error) {
    console.error('Failed to load user slugs:', error)
    return res.status(500).json({ error: 'Failed to load user slugs' })
  }
}

