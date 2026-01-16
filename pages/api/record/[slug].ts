import { kv } from '@vercel/kv'
import { NextApiRequest, NextApiResponse } from 'next'
import { getSession } from 'next-auth/react'

// parse the cookies from the request
const parseCookies = (cookieHeader?: string): Record<string, string> => {
  const cookies: Record<string, string> = {}
  if (!cookieHeader) return cookies
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawVal] = part.split('=')
    const name = rawName?.trim()
    if (!name) continue
    const val = rawVal.join('=').trim()
    cookies[name] = decodeURIComponent(val)
  }
  return cookies
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug } = req.query
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Slug is required' })
  }

  const key = `requests:${slug}`

  try {
    // Read session; require it for this endpoint (only owner may access)
    const session = await getSession()

    if (!session?.user) {
      // check if the slug was created in this browser
      const cookies = parseCookies(req.headers.cookie)
      const slugCreator = cookies[`slug_creator_${slug}`]
      if (!slugCreator) {
        return res.status(401).json({ error: 'Unauthorized: Access denied to slug' })
      } else {
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
      }
    } 

    // Read the owner record for this slug
    const ownerKey = `slug:owner:${slug}`
    let ownerRaw = null
    try {
      ownerRaw = await kv.get(ownerKey)
    } catch (ownerGetErr) {
      console.error('Failed to read owner key from KV:', ownerGetErr)
      return res.status(500).json({ error: 'Failed to verify ownership' })
    }

    if (!ownerRaw) {
      // No owner recorded -> deny access
      return res.status(403).json({ error: 'Forbidden: Access denied to slug' })
    }

    // ownerRaw might be a JSON string or object
    let owner: { id?: string | null; email?: string | null } | null = null
    try {
      owner = typeof ownerRaw === 'string' ? JSON.parse(ownerRaw) : (ownerRaw as any)
    } catch (parseErr) {
      console.error('Failed to parse owner record:', parseErr)
      return res.status(500).json({ error: 'Failed to verify ownership' })
    }

    const sessionId = session.user.id ?? null
    const sessionEmail = session.user.email ?? null

    const ownerId = owner?.id ?? null
    const ownerEmail = owner?.email ?? null

    // Compare owner vs session. Prefer id if present, else compare emails (case-insensitive).
    let isOwner = false
    if (ownerId && sessionId && String(ownerId) === String(sessionId)) {
      isOwner = true
    } else if (ownerEmail && sessionEmail && String(ownerEmail).toLowerCase() === String(sessionEmail).toLowerCase()) {
      isOwner = true
    }

    if (!isOwner) {
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
