import Layout from '@/components/Layout'
import { Analytics } from "@vercel/analytics/next"
import '@vercel/examples-ui/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'

function App({ Component, pageProps }: AppProps) {
  return (
    <Layout>
      <Head>
        <title>Callback Handler</title>
        <meta name="description" content="Record and inspect HTTP requests in real-time" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Component {...pageProps} />
      <Analytics />
    </Layout>
  )
}

export default App
