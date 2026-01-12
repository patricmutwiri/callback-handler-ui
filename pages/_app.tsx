import { Analytics } from "@vercel/analytics/next"
import type { LayoutProps } from '@vercel/examples-ui/layout'
import type { AppProps } from 'next/app'

import { getLayout } from '@vercel/examples-ui'
import '@vercel/examples-ui/globals.css'
import Head from 'next/head'

import PaypalButton from '@/components/PaypalButton'

function App({ Component, pageProps }: AppProps) {
  const Layout = getLayout<LayoutProps>(Component)

  return (
    <Layout
      deployButton={{
        repositoryUrl: 'https://github.com/patricmutwiri/callback-handler-ui',
        projectName: 'callback-handler',
      }}
      path="callback-handler"
    >
      <Head>
        <title>Callback Handler</title>
        <meta name="description" content="How to use Vercel Cron Jobs to update data at different intervals" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Component {...pageProps} />
      <Analytics />
      <PaypalButton />
    </Layout>
  )
}

export default App
