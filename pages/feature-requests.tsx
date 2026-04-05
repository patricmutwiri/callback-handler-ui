/**
 * Project Name: Callback Handler UI
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

import { Text } from '@vercel/examples-ui'
import TurnstileWidget from '@/components/TurnstileWidget'
import { getTurnstileSiteKey } from '@/lib/turnstile.mjs'
import { useSession } from 'next-auth/react'
import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useState } from 'react'
import { absoluteUrl, DEFAULT_OG_IMAGE } from '@/lib/seo'

export default function FeatureRequestsPage() {
  const { data: session, status } = useSession()
  const [featureRequest, setFeatureRequest] = useState({
    requesterName: '',
    requesterEmail: '',
    title: '',
    description: '',
  })
  const [featureSubmitting, setFeatureSubmitting] = useState(false)
  const [featureFeedback, setFeatureFeedback] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)

  const turnstileSiteKey = getTurnstileSiteKey()
  const handleTurnstileTokenChange = useCallback((token: string | null) => {
    setTurnstileToken(token)
  }, [])

  const handleFeatureRequestSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!turnstileToken) {
      setFeatureFeedback('Please complete the CAPTCHA challenge before submitting.')
      return
    }

    setFeatureSubmitting(true)
    setFeatureFeedback(null)

    try {
      const response = await fetch('/api/feature-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...featureRequest,
          turnstileToken,
        }),
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
      setTurnstileToken(null)
      setTurnstileResetKey((current) => current + 1)
    } catch (requestError: any) {
      setFeatureFeedback(requestError.message || 'Failed to submit feature request')
      setTurnstileToken(null)
      setTurnstileResetKey((current) => current + 1)
    } finally {
      setFeatureSubmitting(false)
    }
  }

  const canTrackRequests = status === 'authenticated' && Boolean(session?.user?.email)

  return (
    <>
      <Head>
        <title>Callback Handler | Feature Requests</title>
        <meta
          name="description"
          content="Submit a feature request for Callback Handler and track it through GitHub-backed workflow updates."
        />
        <link rel="canonical" href={absoluteUrl('/feature-requests')} />
        <meta property="og:url" content={absoluteUrl('/feature-requests')} />
        <meta property="og:title" content="Callback Handler - Feature Requests" />
        <meta
          property="og:description"
          content="Submit a feature request for Callback Handler and track it through GitHub-backed workflow updates."
        />
        <meta property="og:image" content={DEFAULT_OG_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Callback Handler - Feature Requests" />
        <meta
          name="twitter:description"
          content="Submit a feature request for Callback Handler and track it through GitHub-backed workflow updates."
        />
        <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />
      </Head>

      <div
        className="fixed inset-0 z-[-1]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.94)), url(/graffiti-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      />

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Text variant="h1">Feature Requests</Text>
            <Text className="mt-2 text-sm text-slate-600">
              Share what would make Callback Handler more useful for your workflow. We will open a GitHub issue automatically and email you when the request is closed.
            </Text>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canTrackRequests && (
              <Link
                href="/my-feature-requests"
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-black"
              >
                Track my requests
              </Link>
            )}
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
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/88 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-8 lg:p-10">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,0.95fr)_minmax(520px,1.05fr)] xl:items-start">
            <div>
              <Text variant="h2">Tell us what to build next</Text>
              <Text className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
                Your request is saved in an admin-only backend queue, mirrored into GitHub for implementation tracking, and tied to your email address only for status updates.
              </Text>
              <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-5 text-sm text-slate-600">
                <div>
                  <Text className="font-semibold text-slate-900">What happens next</Text>
                </div>
                <Text className="text-sm text-slate-600">
                  1. We create a GitHub issue in `patricmutwiri/callback-handler-ui`.
                </Text>
                <Text className="text-sm text-slate-600">
                  2. Admins review and respond from the dashboard.
                </Text>
                <Text className="text-sm text-slate-600">
                  3. When the issue closes, you get an email update.
                </Text>
              </div>
            </div>

            <form onSubmit={handleFeatureRequestSubmit} className="grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="requesterName" className="text-sm font-medium text-slate-700">
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
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-slate-400"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="requesterEmail" className="text-sm font-medium text-slate-700">
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
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-slate-400"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="featureTitle" className="text-sm font-medium text-slate-700">
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
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-slate-400"
                  placeholder="e.g. Slack webhook templates"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="featureDescription" className="text-sm font-medium text-slate-700">
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
                  rows={8}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-slate-400"
                  placeholder="Describe the use case, expected behavior, and anything that would make the feature especially useful."
                  required
                />
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-md">
                  <Text className="text-xs leading-5 text-slate-500">
                    Please avoid secrets or production credentials in feature requests.
                  </Text>
                  {turnstileSiteKey ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <TurnstileWidget
                        action="feature_request"
                        onTokenChange={handleTurnstileTokenChange}
                        resetKey={turnstileResetKey}
                        siteKey={turnstileSiteKey}
                      />
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                      CAPTCHA is not configured for this environment.
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={featureSubmitting || !turnstileSiteKey}
                  className={`inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium text-white transition-colors ${
                    featureSubmitting || !turnstileSiteKey
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-slate-900 hover:bg-black'
                  }`}
                >
                  {featureSubmitting ? 'Submitting...' : 'Submit feature request'}
                </button>
              </div>
            </form>
          </div>

          {featureFeedback && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {featureFeedback}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
