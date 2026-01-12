import { Code, Link, Page, Text } from '@vercel/examples-ui'
import { kv } from '@vercel/kv'
import { GetServerSideProps } from 'next'
import Head from 'next/head'

interface RequestData {
  id: string
  timestamp: string
  method: string
  headers: Record<string, any>
  body: any
  query: Record<string, any>
  ip: string
}

interface Props {
  slug: string
  requests: RequestData[]
  host: string
}

async function getBody(req: any) {
  const buffers = []
  for await (const chunk of req) {
    buffers.push(chunk)
  }
  const data = Buffer.concat(buffers).toString()
  try {
    return JSON.parse(data)
  } catch {
    return data
  }
}

export const getServerSideProps: GetServerSideProps = async ({ req, res, query }) => {
  const slug = query.slug as string
  const key = `requests:${slug}`

  // Detect if this is a browser UI request or Next.js data request
  const isBrowserRequest = (req.method === 'GET' && req.headers.accept?.includes('text/html')) || req.headers['x-nextjs-data']

  if (!isBrowserRequest) {
    try {
      // For GET/DELETE/etc requests, body might be empty or not applicable, but we try to read it if present.
      // Note: Next.js API routes consume body for POST/PUT automatically if body parser enabled, 
      // but getServerSideProps receives raw IncomingMessage.
      const body = await getBody(req)
      const timestamp = new Date().toISOString()
      const forwarded = req.headers['x-forwarded-for']
      const ip = typeof forwarded === 'string' ? forwarded.split(/, /)[0] : req.socket.remoteAddress

      const requestData = {
        id: crypto.randomUUID(),
        timestamp,
        method: req.method,
        headers: req.headers,
        body: body || null,
        query: query,
        ip,
      }

      // Store in Redis List
      await kv.lpush(key, JSON.stringify(requestData))
      // Keep only last 100 requests
      await kv.ltrim(key, 0, 99)

      res.setHeader('Content-Type', 'application/json')
      res.write(JSON.stringify({ success: true, request: requestData }))
      res.end()

      return { props: {} }
    } catch (error) {
      console.error('Failed to record request:', error)
      res.statusCode = 500
      res.write(JSON.stringify({ error: 'Failed to record request' }))
      res.end()
      return { props: {} }
    }
  }

  // UI request (GET + Accept: text/html) - fetch data for UI
  try {
    const rawRequests = await kv.lrange(key, 0, 49) || []
    const requests = rawRequests.map((req) => {
      try {
        return typeof req === 'string' ? JSON.parse(req) : req
      } catch (e) {
        return null
      }
    }).filter(Boolean) as RequestData[]

    return {
      props: {
        slug,
        requests,
        host: req.headers.host || 'localhost:3000',
      },
    }
  } catch (error) {
    console.error('Failed to retrieve requests:', error)
    return {
      props: {
        slug,
        requests: [],
        host: req.headers.host || 'localhost:3000',
      },
    }
  }
}

export default function RecordPage({ slug, requests = [], host }: Props) {
  return (
    <Page>
      <Head>
        <title>Recorded Requests: {slug}</title>
      </Head>

      <section className="flex flex-col gap-6">
        <Link href="/" className="mb-4 text-sm text-gray-500 hover:text-black transition-colors inline-flex items-center gap-1">
          ← Create New
        </Link>
        <div className="flex">
          <img src="/logo.png" alt="Callback Handler Logo" className="w-12 h-12" />
        </div>
        <Text variant="h1">Requests for: {slug}</Text>
        <Text>
          Send POST requests to <Code>https://{host}/record/{slug}</Code> to see them show up here.
        </Text>
      </section>

      <section className="flex flex-col gap-4 mt-8">
        {requests && requests.length === 0 ? (
          <Text>No requests recorded yet (or refresh to see new ones).</Text>
        ) : (
          requests.map((req) => (
            <div key={req.id} className="p-4 border border-gray-200 rounded-lg shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <div className="flex gap-2 items-center">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${req.method === 'POST' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                    {req.method}
                  </span>
                  <Text className="text-sm text-gray-500">{new Date(req.timestamp).toLocaleString()}</Text>
                </div>
                <Text className="text-xs text-gray-400">{req.ip}</Text>
              </div>
              
              <div className="grid gap-2 text-sm">
                <div>
                  <Text className="text-xs uppercase text-gray-500 mb-1">Headers</Text>
                  <pre className="bg-gray-50 p-2 rounded overflow-auto max-h-32 text-xs">
                    {JSON.stringify(req.headers, null, 2)}
                  </pre>
                </div>
                {req.body && (
                  <div>
                    <Text className="text-xs uppercase text-gray-500 mb-1">Body</Text>
                    <pre className="bg-gray-50 p-2 rounded overflow-auto max-h-40 text-xs">
                      {JSON.stringify(req.body, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </Page>
  )
}
