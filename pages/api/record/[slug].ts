import { kv } from '@vercel/kv'
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { getRecordAccessDecision, readOwnerRecord } from '../../../lib/slug-access.mjs'
import { authOptions } from '../auth/[...nextauth]'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug } = req.query
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Slug is required' })
  }

  const key = `requests:${slug}`

  try {
    const session = await getServerSession(req, res, authOptions)

    const ownerKey = `slug:owner:${slug}`
    let ownerRaw = null
    try {
      ownerRaw = await kv.get(ownerKey)
    } catch (ownerGetErr) {
      console.error('Failed to verify ownership:', ownerGetErr)
      return res.status(500).json({ error: 'Failed to verify ownership' })
    }

    let owner = null
    try {
      owner = readOwnerRecord(ownerRaw)
    } catch (parseErr) {
      console.error('Failed to parse owner record:', parseErr)
      return res.status(500).json({ error: 'Failed to verify ownership' })
    }

    const access = getRecordAccessDecision({
      slug,
      cookieHeader: req.headers.cookie,
      sessionUser: session?.user ?? null,
      owner,
    })

    if (!access.authorized) {
      if (access.status === 401) {
        console.warn('Unauthorized: No session found in the request.')
        return res.status(401).json({ error: 'Unauthorized: Access denied to slug' })
      }

      return res.status(403).json({ error: 'Forbidden: Access denied to slug' })
    }

    // get the last 50 requests
    const rawRequests = await kv.lrange(key, 0, 49) || []
    const requests = rawRequests.map((req) => {
      try {
        return typeof req === 'string' ? JSON.parse(req) : req
      } catch (e) {
        console.error('Failed to parse request JSON:', e)
        return null
      }
    }).filter(Boolean)

    return res.status(200).json(requests)
  } catch (error) {
    console.error('Failed to retrieve requests:', error)
    return res.status(500).json({ error: 'Failed to retrieve requests' })
  }
}
