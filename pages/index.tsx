import AuthSection from '@/components/AuthSection'
import { Code, Text } from '@vercel/examples-ui'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState } from 'react'

const SLUG_COOKIE_MAX_AGE = 24 * 60 * 60

export default function Home() {
  const router = useRouter()
  const [title, setTitle] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [featureRequest, setFeatureRequest] = useState({
    requesterName: '',
    requesterEmail: '',
    title: '',
    description: '',
  })
  const [featureSubmitting, setFeatureSubmitting] = useState(false)
  const [featureFeedback, setFeatureFeedback] = useState<string | null>(null)

  // User-input slugs
  const createSlug = (value: string) => {
    // 1. Initial Type/Value Check
    if (typeof value !== 'string' || !value.trim()) {
      return ''
    }

    // 2. Transformation
    let normalised = value
      .toLowerCase()
      .trim()
      .replaceAll(/\s+/g, '-')
      .replaceAll(/[^a-z0-9-]/g, '')
      .replaceAll(/-+/g, '-')
      .replaceAll(/^-+|-+$/g, '')

    // 3. Length Guard (Truncate instead of early return)
    if (normalised.length > 64) {
      normalised = normalised.substring(0, 64).replaceAll(/-+$/, '')
    }

    const isValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalised)

    if (isValid) {
      const d = new Date()
      const month = (d.getMonth() + 1).toString().padStart(2, '0')
      const day = d.getDate().toString().padStart(2, '0')
      return `${normalised}-${month}${day}`
    }

    return ''
  }

  const markSlugCreatedInThisBrowser = (value: string): void => {
    if (!value.trim()) return

    document.cookie = `slug_creator_${value}=1; path=/; max-age=${SLUG_COOKIE_MAX_AGE}; SameSite=Lax`
  }

  const slug = createSlug(title)

  // Auto-generated slugs
  const generateSlug = (): string => {
    const randomSlug = Math.random().toString(36).substring(7)
    return randomSlug.toString()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (slug.trim()) {
      markSlugCreatedInThisBrowser(slug.trim())
      setLoading(true)
      router.push(`/record/${slug.trim()}`)
    }
  }

  const handleFeatureRequestSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFeatureSubmitting(true)
    setFeatureFeedback(null)

    try {
      const response = await fetch('/api/feature-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(featureRequest),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to submit feature request')
      }

      setFeatureFeedback(
        payload.request.githubIssueNumber
          ? `Feature request submitted as GitHub issue #${payload.request.githubIssueNumber}.`
          : 'Feature request submitted successfully.'
      )
      setFeatureRequest({
        requesterName: '',
        requesterEmail: '',
        title: '',
        description: '',
      })
    } catch (requestError: any) {
      setFeatureFeedback(requestError.message || 'Failed to submit feature request')
    } finally {
      setFeatureSubmitting(false)
    }
  }

  return (
    <>
      <Head>
        <title>Callback Handler</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta property="og:title" content="Callback Handler - Record & Inspect HTTP Requests" />
        <meta property="og:description" content="Generate a unique URL to capture HTTP requests and callbacks. Inspect headers, body, and more in real-time." />
        <meta property="og:image" content="https://callback-handler-ui.vercel.app/logo.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://callback-handler-ui.vercel.app/logo.png" />
        <meta name="author" content="Patrick Mutwiri"/>
        <meta name="keywords" content="HTTP requests, API testing, callback handler, request inspection"/>  
      </Head>

      {/* Background Graphic */}
      <div 
        className="fixed inset-0 z-[-1]"
        style={{ 
          backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.8)), url(/graffiti-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      />
      
      <section className="flex flex-col gap-6 mx-auto mt-12 text-center max-w-[90vw] relative">
        <Text variant="h1">Callback Handler</Text>
        <Text>
          Generate a unique URL to capture HTTP requests and callbacks. 
          Inspect headers, body, and more in real-time.
        </Text>
        

        {/* Side by side layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {/* Authentication Section */}
          <div className="flex-shrink-0">
            <AuthSection />
          </div>

          {/* Get Started Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6 border rounded-lg shadow-sm bg-white/80 backdrop-blur-sm">
          <Text variant="h2">Get Started</Text>
          <div className="flex flex-col gap-2 text-left">
            <label htmlFor="slug" className="text-sm font-medium text-gray-700">
              Generate Slug
            </label>
            <small>You can input yours or we can generate one for you by clicking auto generate button below. </small>
            <div className="flex gap-2">
              <input
                id="slug"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. my-webhook"
                className="flex-1 border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setTitle(generateSlug().toString())}
                className="px-4 py-2 text-sm border rounded hover:bg-gray-50 bg-white flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
                  <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
                  <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
                Auto Generate
              </button>
            </div>
            {slug && (
              <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-500 break-all">
                Your endpoint: <Code>https://{globalThis.window === undefined ? '...' : globalThis.window.location.host}/record/{slug}</Code>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 px-4 text-white rounded font-medium transition-colors ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-black hover:bg-gray-800'}`}
          >
            {loading ? 'Redirecting...' : 'Start Recording'}
          </button>
        </form>
        </div>

        <div className="mx-auto mt-4 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white/85 p-6 text-left shadow-sm backdrop-blur-sm">
          <div className="flex flex-col gap-2 text-center sm:text-left">
            <Text variant="h2">Feature Request</Text>
            <Text className="text-sm text-gray-600">
              Tell us what you want next. We will create a GitHub issue automatically and use your email for status updates when the request closes.
            </Text>
          </div>

          <form onSubmit={handleFeatureRequestSubmit} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="requesterName" className="text-sm font-medium text-gray-700">
                Your name
              </label>
              <input
                id="requesterName"
                type="text"
                value={featureRequest.requesterName}
                onChange={(event) =>
                  setFeatureRequest((current) => ({
                    ...current,
                    requesterName: event.target.value,
                  }))
                }
                className="rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="requesterEmail" className="text-sm font-medium text-gray-700">
                Email for updates
              </label>
              <input
                id="requesterEmail"
                type="email"
                value={featureRequest.requesterEmail}
                onChange={(event) =>
                  setFeatureRequest((current) => ({
                    ...current,
                    requesterEmail: event.target.value,
                  }))
                }
                className="rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                required
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <label htmlFor="featureTitle" className="text-sm font-medium text-gray-700">
                Feature title
              </label>
              <input
                id="featureTitle"
                type="text"
                value={featureRequest.title}
                onChange={(event) =>
                  setFeatureRequest((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                className="rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="e.g. Slack webhook templates"
                required
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <label htmlFor="featureDescription" className="text-sm font-medium text-gray-700">
                What problem should this solve?
              </label>
              <textarea
                id="featureDescription"
                value={featureRequest.description}
                onChange={(event) =>
                  setFeatureRequest((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={5}
                className="rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="Describe the use case, expected behavior, and anything that would make the feature especially useful."
                required
              />
            </div>
            <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Text className="text-xs text-gray-500">
                Admins can review and respond from the dashboard. You will get an email update when the related GitHub issue is closed.
              </Text>
              <button
                type="submit"
                disabled={featureSubmitting}
                className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white transition-colors ${
                  featureSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-black hover:bg-gray-800'
                }`}
              >
                {featureSubmitting ? 'Submitting...' : 'Submit feature request'}
              </button>
            </div>
          </form>

          {featureFeedback && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {featureFeedback}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
