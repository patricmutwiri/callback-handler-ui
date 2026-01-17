import AuthSection from '@/components/AuthSection'
import { Code, Text } from '@vercel/examples-ui'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export default function Home() {
  const router = useRouter()
  const [title, setTitle] = useState<string>('')
  const [slug, setSlug] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // User-input slugs
  const createSlug = (value: string) => {
    // 1. Initial Type/Value Check
    if (typeof value !== 'string' || !value.trim()) {
      return '';
    }

    // 2. Transformation
    let normalised = value
      .toLowerCase()
      .trim()
      .replaceAll(/\s+/g, '-')           // Replace spaces with hyphens
      .replaceAll(/[^a-z0-9-]/g, '')     // Remove all non-slug characters
      .replaceAll(/-+/g, '-')            // Collapse multiple hyphens (--)
      .replaceAll(/^-+|-+$/g, '');       // Trim hyphens from start/end

    // 3. Length Guard (Truncate instead of early return)
    if (normalised.length > 64) {
      normalised = normalised.substring(0, 64).replaceAll(/-+$/, '');
    }

    // 4. Final Validation & State Update
    const isValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalised);
    
    if (isValid) {
      const d = new Date();
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      return `${normalised}-${month}${day}`;
    } else {
      return '';
    }
  };
  
  // mark the slug as created in this browser
  const slugCreatedInThisBrowser = (slug: string): void => {
    if(slug.trim().length > 0) {
      const maxAge = 24 * 60 * 60
      document.cookie = `slug_creator_${slug}=1; path=/; max-age=${maxAge}; SameSite=Lax; Author=Mutwiri; Service=Callback-Handler; Repo=https://github.com/patricmutwiri/callback-handler-ui`
    } else {
      console.error('Slug is empty');
    }
  };

  useEffect(() => {
    const validSlug = createSlug(title);
    setSlug(validSlug); // set the slug in the state
    slugCreatedInThisBrowser(validSlug); // mark the slug as created in this browser
  }, [title]);

  // Auto-generated slugs
  const generateSlug = (): string => {
    const randomSlug = Math.random().toString(36).substring(7)
    return randomSlug.toString()
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="Record and inspect HTTP requests" />
        <meta property="og:title" content="Callback Handler - Record & Inspect HTTP Requests" />
        <meta property="og:description" content="Generate a unique URL to capture HTTP requests and callbacks. Inspect headers, body, and more in real-time." />
        <meta property="og:image" content="https://callback-handler-ui.vercel.app/logo.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://callback-handler-ui.vercel.app/logo.png" />
        <meta name="author" content="Patrick Mutwiri"/>
        <meta name="description" content="Record and inspect HTTP requests" />
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
      </section>
    </>
  )
}
