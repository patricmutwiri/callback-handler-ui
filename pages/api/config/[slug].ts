import { kv } from '@vercel/kv'
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug } = req.query
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Slug is required' })
  }

  const key = `config:${slug}`

  if (req.method === 'GET') {
    try {
      const config = await kv.get(key)
      return res.status(200).json(config || { status: 200, body: '{"success": true}' })
    } catch (error) {
      console.error('Failed to get config:', error)
      return res.status(500).json({ error: 'Failed to get configuration' })
    }
  }

  if (req.method === 'POST') {
    try {
      const { status, body } = req.body
      
      // Basic validation
      const statusCode = Number.parseInt(status)
      if (Number.isNaN(statusCode) || statusCode < 100 || statusCode > 599) {
        return res.status(400).json({ error: 'Invalid status code' })
      }

      const config = { status: statusCode, body }
      await kv.set(key, JSON.stringify(config))
      
      return res.status(200).json({ success: true, config })
    } catch (error) {
      console.error('Failed to save config:', error)
      return res.status(500).json({ error: 'Failed to save configuration' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
