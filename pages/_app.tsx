import Layout from '@/components/Layout'
import { Analytics } from "@vercel/analytics/next"
import '@vercel/examples-ui/globals.css'
import { SpeedInsights } from "@vercel/speed-insights/next"
import { SessionProvider } from 'next-auth/react'
import type { AppProps } from 'next/app'
import Head from 'next/head'

function App({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider session={pageProps.session}>
      <Head>
        <title>Callback Handler</title>
        <meta name="description" content="Record and inspect HTTP requests in real-time" />
        <meta name="keywords" content="HTTP requests, API testing, callback handler, request inspection"/>
        <meta name="author" content="Patrick Mutwiri" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Callback Handler" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Layout>
        <Component {...pageProps} />
        <Analytics />
        <SpeedInsights />
      </Layout>
    </SessionProvider>
  )
}

export default App
