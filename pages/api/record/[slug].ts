import { kv } from '@vercel/kv'
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug } = req.query
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Slug is required' })
  }

  const key = `requests:${slug}`

  try {
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
