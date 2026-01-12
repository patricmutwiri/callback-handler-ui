import { Code, Layout, Page, Text } from '@vercel/examples-ui'
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
    <Page>
      <Head>
        <title>Callback Handler</title>
        <meta name="description" content="Record and inspect HTTP requests" />
      </Head>
      
      <section className="flex flex-col gap-6 max-w-2xl mx-auto mt-12 text-center">
        <Text variant="h1">Callback Handler</Text>
        <Text>
          Generate a unique URL to capture HTTP requests and callbacks. 
          Inspect headers, body, and more in real-time.
        </Text>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8 p-6 border rounded-lg shadow-sm bg-white">
          <Text variant="h2">Get Started</Text>
          <div className="flex flex-col gap-2 text-left">
            <label htmlFor="slug" className="text-sm font-medium text-gray-700">
              Choose a Slug
            </label>
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
                className="px-4 py-2 text-sm border rounded hover:bg-gray-50 bg-white"
              >
                Random
              </button>
            </div>
            {slug && (
              <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-500 break-all">
                Your endpoint: <Code>https://{typeof window !== 'undefined' ? window.location.host : '...'}/record/{slug}</Code>
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
    </Page>
  )
}

Home.Layout = Layout
