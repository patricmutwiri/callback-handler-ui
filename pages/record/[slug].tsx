import { Code, Link, Page, Text } from '@vercel/examples-ui'
import { kv } from '@vercel/kv'
import { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useEffect, useState } from 'react'
import useSWR from 'swr'

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

const fetcher = (url: string) => fetch(url).then((res) => res.json())

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

      // Fetch custom response config
      const configKey = `config:${slug}`
      const rawConfig = await kv.get(configKey)
      const config = (typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig) || { status: 200, body: '{"success": true}' }

      res.statusCode = config.status
      res.setHeader('Content-Type', 'application/json')
      res.write(typeof config.body === 'string' ? config.body : JSON.stringify(config.body))
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
        console.error('Failed to parse request JSON:', e)
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

interface ResponseConfig {
  status: number
  body: string
}

export default function RecordPage({ slug, requests: initialRequests = [], host }: Props) {
  const [copied, setCopied] = useState(false)
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [localConfig, setLocalConfig] = useState<ResponseConfig>({
    status: 200,
    body: '{"success": true}'
  })
  
  const { data: requests = initialRequests } = useSWR<RequestData[]>(
    `/api/record/${slug}`,
    fetcher,
    {
      fallbackData: initialRequests,
      refreshInterval: 2000,
    }
  )

  const { data: config, mutate: mutateConfig } = useSWR<ResponseConfig>(
    `/api/config/${slug}`,
    fetcher
  )

  // Sync local state when config is fetched
  useEffect(() => {
    if (config) {
      setLocalConfig(config)
    }
  }, [config])

  const saveConfig = async () => {
    setIsSavingConfig(true)
    try {
      await fetch(`/api/config/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localConfig)
      })
      mutateConfig()
      alert('Response configuration saved!')
    } catch (e) {
      alert('Failed to save configuration')
    } finally {
      setIsSavingConfig(false)
    }
  }

  const curlCommand = String.raw`curl -X POST https://${host}/record/${slug} \
  -H "Content-Type: application/json" \
  -d '{"test": "data", "source": "callback-handler"}'`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(curlCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Page>
      <Head>
        <title>Recorded Requests: {slug}</title>
      </Head>

      <section className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-black transition-colors inline-flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            Create New
          </Link>
        </div>

        <div>
          <Text variant="h1">Requests for: {slug}</Text>
          <Text className="mt-2">
            Send requests to <Code>https://{host}/record/{slug}</Code> to see them show up here.
          </Text>
        </div>

        <div className="bg-gray-50 p-4 border rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <Text className="text-sm font-semibold text-gray-700">Test with CURL</Text>
            <button
              onClick={copyToClipboard}
              className="px-3 py-1 text-xs border rounded bg-white hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              {copied ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="green" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  Copy Command
                </>
              )}
            </button>
          </div>
          <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto font-mono leading-relaxed">
            {curlCommand}
          </pre>
        </div>

        <div className="p-6 border rounded-lg shadow-sm bg-white">
          <Text variant="h2" className="mb-4">Response Configuration</Text>
          <Text className="text-sm text-gray-500 mb-4">
            Customize what this endpoint returns when it receives a request.
          </Text>
          
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="status-code" className="text-xs font-bold uppercase text-gray-500">Status Code</label>
              <input
                id="status-code"
                type="number"
                value={localConfig.status}
                onChange={(e) => setLocalConfig({ ...localConfig, status: Number.parseInt(e.target.value) })}
                className="border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none w-32"
              />
            </div>
            
            <div className="flex flex-col gap-1">
              <label htmlFor="response-body" className="text-xs font-bold uppercase text-gray-500">Response Body (JSON or Text)</label>
              <textarea
                id="response-body"
                value={localConfig.body}
                onChange={(e) => setLocalConfig({ ...localConfig, body: e.target.value })}
                rows={4}
                className="border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none font-mono"
              />
            </div>
            
            <button
              onClick={saveConfig}
              disabled={isSavingConfig}
              className={`px-4 py-2 rounded text-white font-medium self-start transition-colors ${isSavingConfig ? 'bg-gray-400' : 'bg-black hover:bg-gray-800'}`}
            >
              {isSavingConfig ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
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
