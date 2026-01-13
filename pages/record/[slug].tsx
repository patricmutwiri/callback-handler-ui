import { Code, Link, Text } from '@vercel/examples-ui'
import { kv } from '@vercel/kv'
import { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'

interface RequestData {
  id: string
  timestamp: string
  method: string
  headers: Record<string, any>
  body: any
  query: Record<string, any>
  ip: string
  responseStatus?: number
  responseBody?: any
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
  const activeKey = `active:${slug}`

  // Detect if this is a browser UI request or Next.js data request
  const isBrowserRequest = (req.method === 'GET' && req.headers.accept?.includes('text/html')) || req.headers['x-nextjs-data']

  // Check if slug is active
  const isActive = await kv.get(activeKey)

  if (!isBrowserRequest) {
    if (!isActive) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json')
      res.write(JSON.stringify({ error: 'URL not found. Visit the UI to initialize it.' }))
      res.end()
      return { props: {} }
    }

    try {
      const body = await getBody(req)
      const timestamp = new Date()
      const timestampIso = timestamp.toISOString()
      const today = timestampIso.split('T')[0]
      const forwarded = req.headers['x-forwarded-for']
      const ip = typeof forwarded === 'string' ? forwarded.split(/, /)[0] : req.socket.remoteAddress

      // Fetch custom response config
      const configKey = `config:${slug}`
      const rawConfig = await kv.get(configKey)
      const config = (typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig) || { 
        status: 200, 
        body: '{"success": true}',
        contentType: 'application/json'
      }

      const requestData: RequestData = {
        id: crypto.randomUUID(),
        timestamp: timestampIso,
        method: req.method || 'UNKNOWN',
        headers: req.headers,
        body: body || null,
        query: query,
        ip: ip || 'unknown',
        responseStatus: config.status,
        responseBody: config.body
      }

      // 1 month TTL in seconds (30 days)
      const TTL = 30 * 24 * 60 * 60

      // Store in Redis List
      await kv.lpush(key, JSON.stringify(requestData))
      // Keep only last 100 requests
      await kv.ltrim(key, 0, 99)
      
      // Set TTL on all relevant keys
      await Promise.all([
        kv.expire(key, TTL),
        kv.expire(activeKey, TTL),
        kv.expire(configKey, TTL),
        // Update stats
        kv.sadd('all_slugs', slug),
        kv.incr(`stats:total:${today}`),
        kv.incr(`stats:slug:${slug}:${today}`)
      ])

      res.statusCode = config.status
      res.setHeader('Content-Type', config.contentType || 'application/json')
      res.setHeader('X-Author', 'Patrick Mutwiri')
      res.setHeader('X-Repo-URL', 'https://github.com/patricmutwiri/callback-handler-ui')
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
    // Initialize slug if not already active
    if (!isActive) {
      await kv.set(activeKey, true)
    }

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
  contentType: string
}

export default function RecordPage({ slug, requests: initialRequests = [], host }: Props) {
  const [copied, setCopied] = useState(false)
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [localConfig, setLocalConfig] = useState<ResponseConfig>({
    status: 200,
    body: '{"success": true}',
    contentType: 'application/json'
  })
  
  const validateBody = (contentType: string, body: string): string | null => {
    if (!body) return null
    
    if (contentType === 'application/json') {
      try {
        JSON.parse(body)
        return null
      } catch (e: any) {
        return `Invalid JSON: ${e.message}`
      }
    }
    
    if (contentType === 'application/xml' || contentType === 'application/soap+xml') {
      try {
        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(body, "text/xml")
        const parseError = xmlDoc.getElementsByTagName("parsererror")
        if (parseError.length > 0) {
          return `Invalid XML: ${parseError[0].textContent}`
        }
        return null
      } catch (e: any) {
        return `Invalid XML: ${e.message}`
      }
    }
    
    return null
  }

  const getTemplate = (contentType: string) => {
    if (contentType === 'application/json') {
      return JSON.stringify({
        success: true,
        service: "Callback Handler",
        url: `https://${host}/record/${slug}`
      }, null, 2)
    }
    if (contentType === 'application/xml' || contentType === 'application/soap+xml') {
      return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://www.example.com/">
   <soapenv:Header/>
   <soapenv:Body>
      <web:Response>Success</web:Response>
   </soapenv:Body>
</soapenv:Envelope>`
    }
    return ""
  }

  const onContentTypeChange = (newType: string) => {
    const error = validateBody(newType, localConfig.body)
    setValidationError(error)
    
    // Automatically switch to template if body is empty or default
    if (!localConfig.body || localConfig.body === '{"success": true}' || localConfig.body.includes('soapenv:Envelope') || localConfig.body.includes('"service": "Callback Handler"')) {
      const template = getTemplate(newType)
      if (template) {
        setLocalConfig({ ...localConfig, contentType: newType, body: template })
        setValidationError(null)
        return
      }
    }
    
    setLocalConfig({ ...localConfig, contentType: newType })
  }

  const onBodyChange = (newBody: string) => {
    setLocalConfig({ ...localConfig, body: newBody })
    setValidationError(validateBody(localConfig.contentType, newBody))
  }

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
    const error = validateBody(localConfig.contentType, localConfig.body)
    if (error) {
      setValidationError(error)
      alert(`Cannot save: ${error}`)
      return
    }

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
      console.error('Failed to save configuration:', e)
      alert('Failed to save configuration')
    } finally {
      setIsSavingConfig(false)
    }
  }

  const curlCommand = useMemo(() => {
    const isXml = localConfig.contentType === 'application/xml' || localConfig.contentType === 'application/soap+xml'
    const contentType = localConfig.contentType || 'application/json'
    
    if (isXml) {
      return String.raw`curl -X POST https://${host}/record/${slug} \
  -H "Content-Type: ${contentType}" \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://www.example.com/">
   <soapenv:Header/>
   <soapenv:Body>
      <web:Request>Test</web:Request>
   </soapenv:Body>
</soapenv:Envelope>'`
    }

    return String.raw`curl -X POST https://${host}/record/${slug} \
  -H "Content-Type: application/json" \
  -d '{"test": "data", "source": "callback-handler"}'`
  }, [host, slug, localConfig.contentType])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(curlCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getMethodColor = (method: string) => {
    switch (method?.toUpperCase()) {
      case 'POST': return 'bg-green-100 text-green-800'
      case 'GET': return 'bg-blue-100 text-blue-800'
      case 'PUT': return 'bg-yellow-100 text-yellow-800'
      case 'DELETE': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: number) => {
    if (status < 300) return 'bg-green-100 text-green-700'
    if (status < 400) return 'bg-yellow-100 text-yellow-700'
    return 'bg-red-100 text-red-700'
  }

  const copyDataToClipboard = (data: any, label: string) => {
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    navigator.clipboard.writeText(text)
    alert(`${label} copied to clipboard!`)
  }

  return (
    <>
      <Head>
        <title>Recorded Requests: {slug}</title>
        <meta property="og:title" content={`Recorded Requests for ${slug}`} />
        <meta property="og:description" content={`Inspect HTTP requests sent to the ${slug} endpoint in real-time.`} />
        <meta property="og:image" content={`https://${host}/logo.png`} />
      </Head>

      {/* Background Graphic */}
      <div 
        className="fixed inset-0 z-[-1]"
        style={{ 
          backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.95)), url(/records-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      />

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* CURL Section */}
          <div className="bg-gray-50 p-6 border rounded-lg shadow-sm h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
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
            <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono leading-relaxed flex-grow min-h-[140px]">
              {curlCommand}
            </pre>
            <Text className="text-[10px] text-gray-400 mt-2 uppercase font-bold tracking-wider text-center">Copy and run in terminal to test</Text>
          </div>

          {/* Configuration Section */}
          <div className="p-6 border rounded-lg shadow-sm bg-white h-full">
            <Text variant="h2" className="mb-4">Response Configuration</Text>
            <Text className="text-sm text-gray-500 mb-6 border-b pb-4">
              Customize what this endpoint returns.
            </Text>
            
            <div className="flex flex-col gap-6">
              <div className="flex gap-4">
                <div className="flex flex-col gap-1 flex-1">
                  <label htmlFor="status-code" className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Status Code</label>
                  <input
                    id="status-code"
                    type="number"
                    value={localConfig.status}
                    onChange={(e) => setLocalConfig({ ...localConfig, status: Number.parseInt(e.target.value) })}
                    className="border-b border-gray-200 py-1 text-sm focus:border-black focus:outline-none w-full"
                  />
                </div>

                <div className="flex flex-col gap-1 flex-[2]">
                  <label htmlFor="content-type" className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Content Type</label>
                  <select
                    id="content-type"
                    value={localConfig.contentType}
                    onChange={(e) => onContentTypeChange(e.target.value)}
                    className="border-b border-gray-200 py-1 text-sm focus:border-black focus:outline-none w-full bg-transparent"
                  >
                    <option value="application/json">application/json</option>
                    <option value="application/xml">application/xml</option>
                    <option value="application/soap+xml">application/soap+xml</option>
                    <option value="text/plain">text/plain</option>
                    <option value="text/html">text/html</option>
                  </select>
                </div>
              </div>
              
              <div className="flex flex-col gap-1">
                <label htmlFor="response-body" className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Response Body</label>
                <textarea
                  id="response-body"
                  value={localConfig.body}
                  onChange={(e) => onBodyChange(e.target.value)}
                  rows={8}
                  className={`border border-gray-200 rounded p-3 text-xs focus:ring-1 focus:outline-none font-mono ${validationError ? 'border-red-500 focus:ring-red-200' : 'focus:ring-black'}`}
                />
                {validationError && (
                  <span className="text-[10px] text-red-500 font-medium mt-1 uppercase">{validationError}</span>
                )}
              </div>
              
              <button
                onClick={saveConfig}
                disabled={isSavingConfig || !!validationError}
                className={`px-4 py-2 rounded text-xs uppercase tracking-widest font-bold self-end transition-all ${isSavingConfig || !!validationError ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-black text-white hover:bg-gray-800 hover:shadow-lg active:scale-95'}`}
              >
                {isSavingConfig ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 mt-8">
        {requests && requests.length === 0 ? (
          <Text>No requests recorded yet (or refresh to see new ones).</Text>
        ) : (
          requests.map((req) => (
            <div key={req.id} className="p-4 border border-gray-200 rounded-lg shadow-sm bg-white overflow-hidden">
              <div className="flex justify-between items-center mb-4 pb-2 border-b">
                <div className="flex gap-3 items-center">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getMethodColor(req.method)}`}>
                    {req.method}
                  </span>
                  <Text className="text-xs text-gray-400 font-mono">{req.id.substring(0, 8)}</Text>
                  <Text className="text-sm text-gray-500">{new Date(req.timestamp).toLocaleString()}</Text>
                </div>
                <Text className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">IP: {req.ip}</Text>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Column 1: Headers */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center border-b pb-1">
                    <Text className="text-xs uppercase font-bold text-gray-400">Headers</Text>
                    <button 
                      onClick={() => copyDataToClipboard(req.headers, 'Headers')}
                      className="text-gray-400 hover:text-black transition-colors"
                      title="Copy Headers"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5 overflow-auto max-h-64 pr-2 scrollbar-thin">
                    {Object.entries(req.headers).map(([key, value]) => (
                      <div key={key} className="text-xs break-all text-gray-800">
                        <span className="font-semibold text-gray-500 uppercase mr-1" style={{fontSize: '10px'}}>{key}:</span>
                        <span className="font-mono bg-gray-50 px-1 rounded">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Column 2: Request Payload */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center border-b pb-1">
                    <Text className="text-xs uppercase font-bold text-gray-400">Request Payload</Text>
                    {req.body && (
                      <button 
                        onClick={() => copyDataToClipboard(req.body, 'Payload')}
                        className="text-gray-400 hover:text-black transition-colors"
                        title="Copy Payload"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                    )}
                  </div>
                  {req.body ? (
                    <pre className="bg-gray-50 p-3 border rounded text-xs overflow-auto max-h-48 font-mono text-gray-700 whitespace-pre-wrap">
                      {typeof req.body === 'string' ? req.body : JSON.stringify(req.body, null, 2)}
                    </pre>
                  ) : (
                    <div className="h-full flex items-center justify-center border-2 border-dashed rounded-md bg-gray-50 py-10">
                      <Text className="text-xs text-gray-400 italic">No payload provided</Text>
                    </div>
                  )}
                </div>

                {/* Column 3: Mock Response */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center border-b pb-1">
                    <Text className="text-xs uppercase font-bold text-gray-400">Mock Response</Text>
                    <button 
                      onClick={() => copyDataToClipboard(req.responseBody || {"success": true}, 'Response')}
                      className="text-gray-400 hover:text-black transition-colors"
                      title="Copy Response"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500 uppercase" style={{fontSize: '10px'}}>Status:</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusColor(req.responseStatus || 200)}`}>
                        {req.responseStatus || 200}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-gray-500 uppercase" style={{fontSize: '10px'}}>Body:</span>
                      <pre className="bg-gray-50 p-3 border rounded text-xs overflow-auto max-h-48 font-mono text-gray-700 whitespace-pre-wrap">
                        {typeof req.responseBody === 'string' ? 
                          req.responseBody : 
                          JSON.stringify(req.responseBody || {"success": true}, null, 2)
                        }
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </>
  )
}
