/**
 * Project Name: Callback Handler UI
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

import { Text } from '@vercel/examples-ui'
import { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth'
import { useSession } from 'next-auth/react'
import Head from 'next/head'
import Link from 'next/link'
import useSWR from 'swr'
import { authOptions } from './api/auth/[...nextauth]'

interface FeatureRequestRecord {
  id: string
  title: string
  description: string
  requesterName: string
  requesterEmail: string
  status: string
  adminResponse: string
  githubIssueNumber: number | null
  githubIssueUrl: string | null
  githubIssueState: string
  createdAt: string
  updatedAt: string
  closedAt: string | null
}

interface FeatureRequestsResponse {
  requests: FeatureRequestRecord[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
  error?: string
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    }
  }

  return {
    props: {},
  }
}

export default function MyFeatureRequestsPage() {
  const { data: session } = useSession()
  const { data, isLoading, error } = useSWR<FeatureRequestsResponse>(
    '/api/user/feature-requests',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )

  const requests = data?.requests ?? []

  return (
    <>
      <Head>
        <title>Callback Handler - My Feature Requests</title>
        <meta
          name="description"
          content="Track your submitted Callback Handler feature requests and follow their GitHub-backed status."
        />
      </Head>

      <div
        className="fixed inset-0 z-[-1]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.96)), url(/records-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      />

      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Text variant="h1">My Feature Requests</Text>
            <Text className="mt-2 text-sm text-slate-600">
              Track the requests tied to {session?.user?.email || 'your account'}, including GitHub issue status and any admin response.
            </Text>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/feature-requests"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-black"
            >
              Submit another
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-black"
            >
              Back to dashboard
            </Link>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-black" />
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to load your feature requests.
          </div>
        )}

        {!isLoading && !error && requests.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 px-6 py-10 text-center shadow-sm">
            <Text className="text-lg font-semibold text-slate-900">
              No feature requests yet
            </Text>
            <Text className="mt-2 text-sm text-slate-600">
              Submit your first request and you will be able to track it here.
            </Text>
            <div className="mt-4">
              <Link
                href="/feature-requests"
                className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black"
              >
                Open Feature Requests
              </Link>
            </div>
          </div>
        )}

        {requests.length > 0 && (
          <div className="grid gap-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="rounded-3xl border border-slate-200 bg-white/88 p-6 shadow-sm backdrop-blur-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Text className="text-lg font-semibold text-slate-900">
                      {request.title}
                    </Text>
                    <Text className="mt-1 text-sm text-slate-500">
                      Submitted {new Date(request.createdAt).toLocaleString()}
                    </Text>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                      {request.status}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                      GitHub: {request.githubIssueState}
                    </span>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
                  {request.description}
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)]">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Admin response
                    </Text>
                    <Text className="mt-2 text-sm leading-6 text-slate-700">
                      {request.adminResponse || 'No admin response yet. We will keep this page updated as the request moves forward.'}
                    </Text>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                    <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Tracking
                    </Text>
                    <div className="mt-3 space-y-2">
                      <Text className="text-sm text-slate-600">
                        Updated {new Date(request.updatedAt).toLocaleString()}
                      </Text>
                      {request.closedAt && (
                        <Text className="text-sm text-slate-600">
                          Closed {new Date(request.closedAt).toLocaleString()}
                        </Text>
                      )}
                      {request.githubIssueUrl && (
                        <a
                          href={request.githubIssueUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
                        >
                          View GitHub issue #{request.githubIssueNumber}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
