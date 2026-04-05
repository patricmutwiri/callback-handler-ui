/**
 * Project Name: Callback Handler UI
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

import { Text } from '@vercel/examples-ui'
import Head from 'next/head'
import Link from 'next/link'

const PAYPAL_SUPPORT_URL = 'https://www.paypal.com/ncp/payment/G54BFVLVSBVKS'

export default function SupportPage() {
  return (
    <>
      <Head>
        <title>Callback Handler - Support Us</title>
        <meta
          name="description"
          content="Support Callback Handler through the hosted PayPal checkout page."
        />
      </Head>

      <div
        className="fixed inset-0 z-[-1]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.94)), url(/graffiti-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      />

      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Text variant="h1">Support Us</Text>
            <Text className="mt-2 text-sm text-slate-600">
              Support Callback Handler through the hosted PayPal checkout page. We keep the payment flow external so the app stays light and focused.
            </Text>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-black"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to home
          </Link>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/88 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-8 lg:p-10">
          <div className="grid gap-8 md:grid-cols-[minmax(0,0.95fr)_minmax(280px,0.7fr)] md:items-start">
            <div>
              <Text variant="h2">Keep the project moving</Text>
              <Text className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                If Callback Handler saves you time during debugging or webhook work, you can support maintenance and future improvements through PayPal.
              </Text>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/90 p-5">
                <Text className="text-sm font-semibold text-slate-900">Why it opens externally</Text>
                <Text className="mt-2 text-sm leading-6 text-slate-600">
                  We now send support traffic directly to the hosted PayPal page instead of embedding the payment UI in-app. That keeps this page faster, cleaner, and easier to maintain.
                </Text>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-slate-50 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <Text className="text-sm font-semibold text-slate-900">Hosted checkout</Text>
                <span className="rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-900">
                  #Ubuntu
                </span>
              </div>
              <Text className="mt-3 text-sm leading-6 text-slate-600">
                Open the secure PayPal page in a new tab and complete support there.
              </Text>

              <a
                href={PAYPAL_SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-black"
              >
                Continue to PayPal
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
