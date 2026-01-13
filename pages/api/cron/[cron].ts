import { kv } from '@vercel/kv'
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { cron } = req.query
  if (!cron) return res.status(400).json({ error: 'No cron provided' })
  
  const response = await generateDailySummary()
  return res.status(200).json(response)
}

async function generateDailySummary() {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateStr = yesterday.toISOString().split('T')[0]

  const totalHitsKey = `stats:total:${dateStr}`
  const totalHits = await kv.get(totalHitsKey) || 0

  const allSlugs = await kv.smembers('all_slugs')
  const slugStats = []

  for (const slug of allSlugs) {
    const hits = await kv.get(`stats:slug:${slug}:${dateStr}`)
    if (hits) {
      slugStats.push({ slug, hits: Number(hits) })
    }
  }

  // Sort by hits descending
  slugStats.sort((a, b) => b.hits - a.hits)

  const summary = {
    date: dateStr,
    totalHits: Number(totalHits),
    activeSlugsCount: slugStats.length,
    topSlugs: slugStats.slice(0, 5),
    generatedAt: new Date().toISOString()
  }

  // Store summary for history
  await kv.set(`summary:${dateStr}`, JSON.stringify(summary))
  
  // Clean up daily stats (keep them for a week just in case)
  const statsTTL = 7 * 24 * 60 * 60
  await kv.expire(totalHitsKey, statsTTL)
  for (const slug of allSlugs) {
     await kv.expire(`stats:slug:${slug}:${dateStr}`, statsTTL)
  }

  return summary
}
