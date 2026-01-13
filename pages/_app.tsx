import Layout from '@/components/Layout'
import { Analytics } from "@vercel/analytics/next"
import '@vercel/examples-ui/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'

function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Callback Handler</title>
        <meta name="description" content="Record and inspect HTTP requests in real-time" />
        <meta name="author" content="Patrick Mutwiri" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Callback Handler" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Layout>
        <Component {...pageProps} />
        <Analytics />
      </Layout>
    </>
  )
}

export default App
