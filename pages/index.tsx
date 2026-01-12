import { Code, Text } from '@vercel/examples-ui'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState } from 'react'

export default function Home() {
  const router = useRouter()
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)

  const generateSlug = () => {
    const d = new Date()
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const day = d.getDate().toString().padStart(2, '0')
    const randomSlug = Math.random().toString(36).substring(7)
    setSlug(`${randomSlug}-${month}${day}`)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (slug.trim()) {
      setLoading(true)
      router.push(`/record/${slug.trim()}`)
    }
  }

  return (
    <>
      <Head>
        <title>Callback Handler</title>
        <meta name="description" content="Record and inspect HTTP requests" />
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
      
      <section className="flex flex-col gap-6 mx-auto mt-12 text-center max-w-[50vw] relative">
        <Text variant="h1">Callback Handler</Text>
        <Text>
          Generate a unique URL to capture HTTP requests and callbacks. 
          Inspect headers, body, and more in real-time.
        </Text>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8 p-6 border rounded-lg shadow-sm bg-white">
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
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. my-webhook"
                className="flex-1 border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none"
                required
              />
              <button
                type="button"
                onClick={generateSlug}
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
      </section>
    </>
  )
}
