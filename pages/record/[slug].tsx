import { Code, Link, Text } from '@vercel/examples-ui'
import { kv } from '@vercel/kv'
import { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth'
import { signIn, useSession } from 'next-auth/react'
import Head from 'next/head'
import { authOptions } from 'pages/api/auth/[...nextauth]'
import PusherServer from 'pusher'
import Pusher from 'pusher-js'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
  if (req.body) return req.body
  const buffers: Uint8Array[] = []
  let total = 0
  const LIMIT = 1024 * 1024 // 1MB safety limit
  for await (const chunk of req) {
    const c: Uint8Array = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    total += c.length
    if (total > LIMIT) {
      // stop accumulating overly large bodies
      break
    }
    buffers.push(c)
  }
  const data = Buffer.concat(buffers).toString()
  try {
    return JSON.parse(data)
  } catch {
    return data
  }
}

export const getServerSideProps: GetServerSideProps = async ({ req, res, query }) => {
  const session = await getServerSession(req, res, authOptions)
  const slug = query.slug as string
  const key = `requests:${slug}`
  const activeKey = `active:${slug}`

  const accept = (req.headers.accept || '') as string
  const isNextData = Boolean(req.headers['x-nextjs-data'])
  const isBrowserRequest = (req.method === 'GET' && accept.includes('text/html')) || isNextData

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
      let config: any
      if (typeof rawConfig === 'string') {
        try { config = JSON.parse(rawConfig) } catch { config = null }
      } else {
        config = rawConfig
      }
      config = config || { 
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

      // 1 Year TTL in seconds
      const TTL = 365 * 24 * 60 * 60

      // Store in Redis List
      await kv.lpush(key, JSON.stringify(requestData))
      // Keep only last 100 requests
      await kv.ltrim(key, 0, 99)
      
      // Fire-and-forget stats/expiry to reduce latency
      ;(async () => {
        try {
          await Promise.all([
            kv.expire(key, TTL),
            kv.expire(activeKey, TTL),
            kv.expire(configKey, TTL),
            kv.sadd('all_slugs', slug),
            kv.incr(`stats:total:${today}`),
            kv.incr(`stats:slug:${slug}:${today}`)
          ])
        } catch (e) {
          console.error('Non-fatal stats/expire failure', e)
        }
      })()

      // Trigger Pusher event for real-time update
      try {
        const promoter = new PusherServer({
          appId: process.env.PUSHER_APP_ID!,
          key: process.env.PUSHER_KEY!,
          secret: process.env.PUSHER_SECRET!,
          cluster: process.env.PUSHER_CLUSTER!,
          useTLS: true
        })

        await promoter.trigger(`slug-${slug}`, 'new-request', {
          id: requestData.id
        })
      } catch (e) {
        console.error('Pusher trigger failed:', e)
      }

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
    
    // tie slug to logged-in user if available and no owner exists yet (non-blocking)
    ;(async () => {
      try {
        const session = await getServerSession(req, res, authOptions)
        if (session?.user) {
          const userId = session.user.id ?? session.user.email ?? null
          if (userId) {
            const ownerKey = `slug:owner:${slug}`
            const existingOwner = await kv.get(ownerKey)
            if (!existingOwner) {
              const ownerData = {
                id: userId,
                email: session.user.email ?? null,
                name: session.user.name ?? null,
                image: session.user.image ?? null,
                provider: session.user.provider ?? null
              }
              await kv.set(ownerKey, JSON.stringify(ownerData))
              await kv.sadd(`user_slugs:${userId}`, slug)
            }
          }
        }
      } catch (ownerErr) {
        console.error('Failed to persist slug owner mapping:', ownerErr)
      }
    })()

    const rawRequests = await kv.lrange(key, 0, 49) || []
    const requests = (rawRequests as any[]).map((item) => {
      if (!item) return null
      if (typeof item === 'object') return item as RequestData
      try { return JSON.parse(item as string) } catch { return null }
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
  const [copiedBrowser, setCopiedBrowser] = useState(false)
  const [activeTab, setActiveTab] = useState<'curl' | 'browser'>('curl')
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [testResponse, setTestResponse] = useState<{ status: number; data: any; headers: Record<string, string> } | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [protocol, setProtocol] = useState<string>('https:') // Default to https: for SSR
  const [methodFilter, setMethodFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [dateFilter, setDateFilter] = useState<string>('') // yyyy-mm-dd
  const [pageSize, setPageSize] = useState<number>(10)
  const [currentPage, setCurrentPage] = useState<number>(1)
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

  const onContentTypeChange = useCallback((newType: string) => {
    const error = validateBody(newType, localConfig.body)
    setValidationError(error)
    if (!localConfig.body || localConfig.body === '{"success": true}' || localConfig.body.includes('soapenv:Envelope') || localConfig.body.includes('"service": "Callback Handler"')) {
      const template = getTemplate(newType)
      if (template) {
        setLocalConfig((prev) => ({ ...prev, contentType: newType, body: template }))
        setValidationError(null)
        return
      }
    }
    setLocalConfig((prev) => ({ ...prev, contentType: newType }))
  }, [localConfig.body])

  const onBodyChange = useCallback((newBody: string) => {
    setLocalConfig((prev) => ({ ...prev, body: newBody }))
    setValidationError(validateBody(localConfig.contentType, newBody))
  }, [localConfig.contentType])

  const { data: requests = initialRequests, mutate: mutateRequests } = useSWR<RequestData[]>(
    `/api/record/${slug}`,
    fetcher,
    {
      fallbackData: initialRequests,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      refreshInterval: 180000,
    }
  )

  const { data: session } = useSession()

  // Derived + filtered data
  const filteredRequests = useMemo(() => {
    let result: RequestData[] = Array.isArray(requests) ? requests.slice() : []

    if (methodFilter && methodFilter !== 'ALL') {
      result = result.filter((r) => r.method?.toUpperCase() === methodFilter)
    }

    if (statusFilter.trim()) {
      const statusNum = Number.parseInt(statusFilter.trim(), 10)
      if (!Number.isNaN(statusNum)) {
        result = result.filter((r) => (r.responseStatus ?? 200) === statusNum)
      }
    }

    if (dateFilter) {
      result = result.filter((r) => {
        if (!r.timestamp) return false
        try {
          const d = new Date(r.timestamp)
          const isoDate = d.toISOString().split('T')[0]
          return isoDate === dateFilter
        } catch {
          return false
        }
      })
    }

    return result
  }, [requests, methodFilter, statusFilter, dateFilter])

  // Pagination
  const safePageSize = pageSize > 0 ? pageSize : 10
  const totalPages = Math.max(1, Math.ceil((filteredRequests.length || 0) / safePageSize))
  const currentPageClamped = Math.min(Math.max(currentPage, 1), totalPages)

  // Pagination: guard against non-array just in case
  const paginatedRequests = useMemo(() => {
    const safeFiltered = Array.isArray(filteredRequests) ? filteredRequests : []
    const start = (currentPageClamped - 1) * safePageSize
    const end = start + safePageSize
    return safeFiltered.slice(start, end)
  }, [filteredRequests, currentPageClamped, safePageSize])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [methodFilter, statusFilter, dateFilter, safePageSize])

  // Set protocol on client side to avoid hydration mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setProtocol(window.location.protocol)
    }
  }, [])

  const handlePageSizeChange = useCallback((value: string) => {
    const n = Number.parseInt(value, 10)
    setPageSize((prev) => {
      if (Number.isNaN(n) || n <= 0) return 10
      return n
    })
  }, [])

  // Real-time updates via Pusher
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!process.env.NEXT_PUBLIC_PUSHER_KEY) return

    const pusherClient = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1'
    })

    const channel = pusherClient.subscribe(`slug-${slug}`)
    channel.bind('new-request', () => {
      mutateRequests()
    })

    return () => {
      pusherClient.unsubscribe(`slug-${slug}`)
      pusherClient.disconnect()
    }
  }, [slug, mutateRequests])

  const { data: config, mutate: mutateConfig } = useSWR<ResponseConfig>(
    `/api/config/${slug}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5000 }
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
    const baseUrl = `${protocol}//${host}/record/${slug}`
    
    if (isXml) {
      return String.raw`curl -v -X POST ${baseUrl} \
  -H "Content-Type: ${contentType}" \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://www.example.com/">
   <soapenv:Header/>
   <soapenv:Body>
      <web:Request>Test</web:Request>
   </soapenv:Body>
</soapenv:Envelope>'`
    }

    return String.raw`curl -v -X POST ${baseUrl} \
  -H "Content-Type: application/json" \
  -d '{"test": "data", "source": "callback-handler"}'`
  }, [host, slug, localConfig.contentType, protocol])

  const browserConsoleCode = useMemo(() => {
    const isXml = localConfig.contentType === 'application/xml' || localConfig.contentType === 'application/soap+xml'
    const contentType = localConfig.contentType || 'application/json'
    const url = `${protocol}//${host}/record/${slug}`
    
    if (isXml) {
      return `fetch('${url}', {
  method: 'POST',
  headers: {
    'Content-Type': '${contentType}'
  },
  body: \`<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://www.example.com/">
   <soapenv:Header/>
   <soapenv:Body>
      <web:Request>Test</web:Request>
   </soapenv:Body>
</soapenv:Envelope>\`
})
  .then(response => response.text())
  .then(data => console.log('Response:', data))
  .catch(error => console.error('Error:', error));`
    }

    return `fetch('${url}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    test: 'data',
    source: 'callback-handler'
  })
})
  .then(response => response.json())
  .then(data => console.log('Response:', data))
  .catch(error => console.error('Error:', error));`
  }, [host, slug, localConfig.contentType, protocol])

  const copyToClipboard = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    navigator.clipboard.writeText(curlCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [curlCommand])

  const copyBrowserCodeToClipboard = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    navigator.clipboard.writeText(browserConsoleCode)
    setCopiedBrowser(true)
    setTimeout(() => setCopiedBrowser(false), 2000)
  }, [browserConsoleCode])

  const executeTest = async () => {
    setIsTesting(true)
    setTestError(null)
    setTestResponse(null)

    try {
      const isXml = localConfig.contentType === 'application/xml' || localConfig.contentType === 'application/soap+xml'
      const contentType = localConfig.contentType || 'application/json'
      const url = `${protocol}//${host}/record/${slug}`

      let body: string
      if (isXml) {
        body = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://www.example.com/">
   <soapenv:Header/>
   <soapenv:Body>
      <web:Request>Test</web:Request>
   </soapenv:Body>
</soapenv:Envelope>`
      } else {
        body = JSON.stringify({
          test: 'data',
          source: 'callback-handler'
        })
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': contentType
        },
        body
      })

      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      let responseData: any
      const responseContentType = response.headers.get('content-type') || ''
      if (responseContentType.includes('application/json')) {
        responseData = await response.json()
      } else {
        responseData = await response.text()
      }

      setTestResponse({
        status: response.status,
        data: responseData,
        headers: responseHeaders
      })

      // Refresh the requests list to show the new request
      mutateRequests()
    } catch (error: any) {
      setTestError(error.message || 'Failed to execute test request')
    } finally {
      setIsTesting(false)
    }
  }

  const exportData = (format: 'json' | 'csv') => {
    if(!session) {
      alert('Please login to export your historical requests.')
      return
    }
    
    const data = filteredRequests
    if (!data || data.length === 0) {
      alert('No requests to export (check your filters).')
      return
    }

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `requests-${slug}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      return
    }

    // CSV
    const headers = ['id', 'timestamp', 'method', 'ip', 'responseStatus', 'requestBody', 'responseBody']
    const rows = data.map((r) => {
      const requestBody = typeof r.body === 'string' ? r.body : JSON.stringify(r.body ?? null)
      const responseBody = typeof r.responseBody === 'string' ? r.responseBody : JSON.stringify(r.responseBody ?? null)

      const csvSafe = (val: unknown) => {
        if (val === null || val === undefined) return ''
        const s = String(val)
        if (s.includes('"') || s.includes(',') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`
        }
        return s
      }

      return [
        csvSafe(r.id),
        csvSafe(r.timestamp),
        csvSafe(r.method),
        csvSafe(r.ip),
        csvSafe(r.responseStatus ?? 200),
        csvSafe(requestBody),
        csvSafe(responseBody),
      ].join(',')
    })

    const csvContent = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `requests-${slug}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getMethodColor = useCallback((method: string) => {
    switch (method?.toUpperCase()) {
      case 'POST': return 'bg-green-100 text-green-800'
      case 'PATCH': return 'bg-green-100 text-green-700'
      case 'GET': return 'bg-blue-100 text-blue-800'
      case 'PUT': return 'bg-yellow-100 text-yellow-800'
      case 'DELETE': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }, [])

  const getStatusColor = useCallback((status: number) => {
    if (status < 300) return 'bg-green-100 text-green-700'
    if (status < 400) return 'bg-yellow-100 text-yellow-700'
    return 'bg-red-100 text-red-700'
  }, [])

  const copyDataToClipboard = useCallback((data: any, label: string) => {
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text)
      alert(`${label} copied to clipboard!`)
    }
  }, [])

  const RequestItem: React.FC<{ req: RequestData; getMethodColor: (m: string) => string; getStatusColor: (s: number) => string; copyDataToClipboard: (d: any, l: string) => void; }> = React.memo(({ req, getMethodColor, getStatusColor, copyDataToClipboard }) => {
    return (
      <div key={req.id} className="p-4 border border-gray-200 rounded-lg shadow-sm bg-white overflow-hidden">
        <div className="flex justify-between items-center mb-4 pb-2 border-b">
          <div className="flex gap-3 items-center">
            <span className={`px-2 py-1 rounded text-xs font-bold ${getMethodColor(req.method)}`}>
              {req.method}
            </span>
            <span className="text-xs text-gray-400 font-mono">{req.id.substring(0, 8)}</span>
            <span className="text-sm text-gray-500">{new Date(req.timestamp).toLocaleString('en-US', {dateStyle: 'medium', timeStyle: 'short'})}</span>
          </div>
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">IP: {req.ip}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center border-b pb-1">
              <span className="text-xs uppercase font-bold text-gray-400">Headers</span>
              <button onClick={() => copyDataToClipboard(req.headers, 'Headers')} className="text-gray-400 hover:text-black transition-colors" title="Copy Headers">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
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
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center border-b pb-1">
              <span className="text-xs uppercase font-bold text-gray-400">Request Payload</span>
              {req.body && (
                <button onClick={() => copyDataToClipboard(req.body, 'Payload')} className="text-gray-400 hover:text-black transition-colors" title="Copy Payload">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
              )}
            </div>
            {req.body ? (
              <pre className="bg-gray-50 p-3 border rounded text-xs overflow-auto max-h-48 font-mono text-gray-700 whitespace-pre-wrap">{typeof req.body === 'string' ? req.body : JSON.stringify(req.body, null, 2)}</pre>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed rounded-md bg-gray-50 py-10">
                <span className="text-xs text-gray-400 italic">No payload provided</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center border-b pb-1">
              <span className="text-xs uppercase font-bold text-gray-400">Mock Response</span>
              <button onClick={() => copyDataToClipboard(req.responseBody || {"success": true}, 'Response')} className="text-gray-400 hover:text-black transition-colors" title="Copy Response">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500 uppercase" style={{fontSize: '10px'}}>Status:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusColor(req.responseStatus || 200)}`}>{req.responseStatus || 200}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-500 uppercase" style={{fontSize: '10px'}}>Body:</span>
                <pre className="bg-gray-50 p-3 border rounded text-xs overflow-auto max-h-48 font-mono text-gray-700 whitespace-pre-wrap">{typeof req.responseBody === 'string' ? req.responseBody : JSON.stringify(req.responseBody || {"success": true}, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  })

  return (
    <>
      <Head>
        <title>Callback Handler - Recorded Requests: {slug}</title>
        <meta property="og:title" content={`Recorded Requests for ${slug}`} />
        <meta property="og:description" content={`Inspect HTTP requests sent to the ${slug} endpoint in real-time.`} />
        <meta property="og:image" content={`https://${host}/logo.png`} />
        <meta name="author" content="Patrick Mutwiri"/>
        <meta name="description" content="Record and inspect HTTP requests" />
        <meta name="keywords" content="HTTP requests, API testing, callback handler, request inspection"/>  
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
          <div className="mt-4 flex flex-wrap gap-4 items-end text-sm">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Method</label>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="border-b border-gray-200 py-1 text-sm focus:border-black focus:outline-none bg-transparent min-w-[120px]"
              >
                <option value="ALL">All</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Status</label>
              <input
                type="number"
                placeholder="e.g. 200"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent border-b border-gray-200 py-1 text-sm focus:border-black focus:outline-none min-w-[120px]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Date</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-transparent border-b border-gray-200 py-1 text-sm focus:border-black focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Items per page</label>
              <input
                type="number"
                min={1}
                value={safePageSize}
                onChange={(e) => handlePageSizeChange(e.target.value)}
                className="bg-transparent border-b border-gray-200 py-1 text-sm focus:border-black focus:outline-none w-24"
              />
            </div>

            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => exportData('json')}
                className="px-3 py-1 text-xs border rounded bg-transparent hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 3c-1.5 0-3 1-3 3v2c0 1-.5 2-1.5 2.5C4.5 11 5 12 5 13v2c0 2 1.5 3 3 3" />
                  <path d="M16 3c1.5 0 3 1 3 3v2c0 1 .5 2 1.5 2.5C19.5 11 19 12 19 13v2c0 2-1.5 3-3 3" />
                </svg>
                Export JSON
              </button>
              <button
                onClick={() => exportData('csv')}
                className="px-3 py-1 text-xs border rounded bg-transparent hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <path d="M8 8h3" />
                  <path d="M8 12h3" />
                  <path d="M8 16h3" />
                  <path d="M13 8h3" />
                  <path d="M13 12h3" />
                  <path d="M13 16h3" />
                </svg>
                Export CSV
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Test Section */}
          <div className="bg-gray-50 p-6 border rounded-lg shadow-sm h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <Text className="text-sm font-semibold text-gray-700">Test Endpoint</Text>
            </div>
            
            {/* Tabs */}
            <div className="flex gap-2 mb-4 border-b">
              <button
                onClick={() => setActiveTab('curl')}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  activeTab === 'curl'
                    ? 'border-b-2 border-black text-black'
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                cURL
              </button>
              <button
                onClick={() => setActiveTab('browser')}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  activeTab === 'browser'
                    ? 'border-b-2 border-black text-black'
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                Browser Console
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'curl' ? (
              <div className="flex flex-col flex-grow">
                <div className="flex justify-end gap-2 mb-2">
                  <button
                    onClick={executeTest}
                    disabled={isTesting}
                    className={`px-3 py-1 text-xs border rounded transition-colors flex items-center gap-2 ${
                      isTesting
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-black text-white hover:bg-gray-800'
                    }`}
                  >
                    {isTesting ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                          <circle cx="12" cy="12" r="10"></circle>
                          <path d="M12 6v6l4 2"></path>
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        Test
                      </>
                    )}
                  </button>
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
                <Text className="text-[10px] text-gray-400 mt-2 uppercase font-bold tracking-wider text-center">Copy and run in terminal, or click Test to execute from browser</Text>
                
                {/* Test Response Display */}
                {testError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="red" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <Text className="text-xs font-semibold text-red-800">Error</Text>
                    </div>
                    <Text className="text-xs text-red-700">{testError}</Text>
                  </div>
                )}
                
                {testResponse && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="green" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <Text className="text-xs font-semibold text-green-800">Response</Text>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          testResponse.status < 300 ? 'bg-green-100 text-green-700' :
                          testResponse.status < 400 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {testResponse.status}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setTestResponse(null)
                          setTestError(null)
                        }}
                        className="text-green-600 hover:text-green-800"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                    <div className="mt-2">
                      <Text className="text-xs font-semibold text-green-700 mb-1">Body:</Text>
                      <pre className="text-xs bg-white p-2 rounded border border-green-200 overflow-x-auto font-mono text-gray-800 max-h-48 overflow-y-auto">
                        {typeof testResponse.data === 'string' 
                          ? testResponse.data 
                          : JSON.stringify(testResponse.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col flex-grow">
                <div className="flex justify-end gap-2 mb-2">
                  <button
                    onClick={executeTest}
                    disabled={isTesting}
                    className={`px-3 py-1 text-xs border rounded transition-colors flex items-center gap-2 ${
                      isTesting
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-black text-white hover:bg-gray-800'
                    }`}
                  >
                    {isTesting ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                          <circle cx="12" cy="12" r="10"></circle>
                          <path d="M12 6v6l4 2"></path>
                        </svg>
                        Testing...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        Test
                      </>
                    )}
                  </button>
                  <button
                    onClick={copyBrowserCodeToClipboard}
                    className="px-3 py-1 text-xs border rounded bg-white hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    {copiedBrowser ? (
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
                        Copy Code
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono leading-relaxed flex-grow min-h-[140px]">
                  {browserConsoleCode}
                </pre>
                <Text className="text-[10px] text-gray-400 mt-2 uppercase font-bold tracking-wider text-center">Copy and paste in browser console, or click Test to execute from browser</Text>
                
                {/* Test Response Display */}
                {testError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="red" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <Text className="text-xs font-semibold text-red-800">Error</Text>
                    </div>
                    <Text className="text-xs text-red-700">{testError}</Text>
                  </div>
                )}
                
                {testResponse && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="green" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <Text className="text-xs font-semibold text-green-800">Response</Text>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          testResponse.status < 300 ? 'bg-green-100 text-green-700' :
                          testResponse.status < 400 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {testResponse.status}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setTestResponse(null)
                          setTestError(null)
                        }}
                        className="text-green-600 hover:text-green-800"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                    <div className="mt-2">
                      <Text className="text-xs font-semibold text-green-700 mb-1">Body:</Text>
                      <pre className="text-xs bg-white p-2 rounded border border-green-200 overflow-x-auto font-mono text-gray-800 max-h-48 overflow-y-auto">
                        {typeof testResponse.data === 'string' 
                          ? testResponse.data 
                          : JSON.stringify(testResponse.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
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
        {(!session) && (
          <div id="auth-section" className="bg-gray-50 p-6 border rounded-lg shadow-sm h-full flex justify-end ">
            
            <div className="flex gap-3 md:flex-row sm:flex-col xs:flex-col">
              <button>Please login to view and manage your historical requests.</button>
              {/* GitHub */}
              <button
                onClick={() => signIn('github', { callbackUrl: window.location.href })}
                className="xw-full px-4 py-3 border rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-3 bg-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <span className="font-medium">Continue with GitHub</span>
              </button>

              {/* Google */}
              <button
                onClick={() => signIn('google', { callbackUrl: window.location.href })}
                className="xw-full px-4 py-3 border rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-3 bg-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="font-medium">Continue with Google</span>
              </button>
            </div>
          </div>
        )}

        {(!requests || requests.length === 0) && (
          <Text>No requests recorded yet.</Text>
        )}

        {requests && requests.length > 0 && filteredRequests.length === 0 && (
          <Text>No requests match the current filters.</Text>
        )}
        
        {paginatedRequests.map((req) => (
          <RequestItem key={req.id} req={req} getMethodColor={getMethodColor} getStatusColor={getStatusColor} copyDataToClipboard={copyDataToClipboard} />
        ))}

        {filteredRequests.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
            <div>
              Showing{' '}
              <span className="font-semibold">
                {(currentPageClamped - 1) * safePageSize + 1}
              </span>{' '}
              -{' '}
              <span className="font-semibold">
                {Math.min(currentPageClamped * safePageSize, filteredRequests.length)}
              </span>{' '}
              of{' '}
              <span className="font-semibold">
                {filteredRequests.length}
              </span>{' '}
              requests
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPageClamped === 1}
                className={`px-3 py-1 border rounded ${
                  currentPageClamped === 1
                    ? 'text-gray-300 border-gray-100 cursor-not-allowed'
                    : 'hover:bg-gray-50'
                }`}
              >
                Previous
              </button>
              <span>
                Page{' '}
                <span className="font-semibold">
                  {currentPageClamped}
                </span>{' '}
                of{' '}
                <span className="font-semibold">
                  {totalPages}
                </span>
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPageClamped === totalPages}
                className={`px-3 py-1 border rounded ${
                  currentPageClamped === totalPages
                    ? 'text-gray-300 border-gray-100 cursor-not-allowed'
                    : 'hover:bg-gray-50'
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  )
}

