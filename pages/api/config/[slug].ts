import { kv } from '@vercel/kv'
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { canAccessSlugConfig, readOwnerRecord } from '../../../lib/slug-access.mjs'
import { authOptions } from '../auth/[...nextauth]'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug } = req.query
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Slug is required' })
  }

  const key = `config:${slug}`

  const session = await getServerSession(req, res, authOptions)
  const ownerRaw = await kv.get(`slug:owner:${slug}`)
  const owner = readOwnerRecord(ownerRaw)
  const hasAccess = canAccessSlugConfig({
    slug,
    cookieHeader: req.headers.cookie,
    sessionUser: session?.user ?? null,
    owner,
  })

  if (!hasAccess) {
    return res.status(403).json({ error: 'Forbidden: Access denied to slug configuration' })
  }

  if (req.method === 'GET') {
    try {
      const config = await kv.get(key)
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30')
      return res.status(200).json(config || { status: 200, body: '{"success": true}', contentType: 'application/json' })
    } catch (error) {
      console.error('Failed to get config:', error)
      return res.status(500).json({ error: 'Failed to get configuration' })
    }
  }

  if (req.method === 'POST') {
    try {
      const { status, body, contentType } = req.body
      
      // Basic validation
      const statusCode = Number.parseInt(status)
      if (Number.isNaN(statusCode) || statusCode < 100 || statusCode > 599) {
        return res.status(400).json({ error: 'Invalid status code' })
      }

      const config = { 
        status: statusCode, 
        body, 
        contentType: contentType || 'application/json' 
      }
      await kv.set(key, JSON.stringify(config))
      
      return res.status(200).json({ success: true, config })
    } catch (error) {
      console.error('Failed to save config:', error)
      return res.status(500).json({ error: 'Failed to save configuration' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
