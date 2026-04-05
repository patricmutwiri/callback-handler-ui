import { Code, Text } from '@vercel/examples-ui'
import { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth'
import { useSession } from 'next-auth/react'
import Head from 'next/head'
import Link from 'next/link'
import Pusher from 'pusher-js'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { authOptions } from './api/auth/[...nextauth]'

interface DashboardProps {
  host: string
}

interface AdminUsageStats {
  totalRequests: number
  guestRequests: number
  authenticatedRequests: number
  uniqueSlugs: number
}

interface UserSlug {
  slug: string
  createdAt: string | null
  deletionRequestedAt: string | null
  deletionEligibleAfter: string | null
  deletionStatus: 'pending' | 'none'
  deletionReason?: string | null
}

interface SlugsResponse {
  slugs: UserSlug[]
  error?: string
}

interface AdminUsageRequest {
  id: string
  slug: string
  timestamp: string
  method: string
  ip: string
  responseStatus?: number
  accessType: 'guest' | 'authenticated'
  ownerEmail?: string | null
}

interface AdminUsageResponse {
  stats: AdminUsageStats
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
  recentRequests: AdminUsageRequest[]
  error?: string
}

interface AdminAlert {
  id: string
  slug: string
  type: string
  message: string
  timestamp: string
}

interface AdminDeletionRequest {
  id: string
  slug: string
  status: string
  reason: string
  requestedAt: string
  eligibleAfter: string
  archivedAt?: string | null
  archiveKey?: string | null
  requestedBy?: {
    email?: string | null
    name?: string | null
  }
}

interface AdminDeletionRequestsResponse {
  requests: AdminDeletionRequest[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
  error?: string
}

interface AdminFeatureRequest {
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

interface AdminFeatureRequestsResponse {
  requests: AdminFeatureRequest[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
  error?: string
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())
const ADMIN_USAGE_PAGE_SIZE = 10
const ADMIN_DELETION_PAGE_SIZE = 5
const ADMIN_FEATURE_PAGE_SIZE = 5

export const getServerSideProps: GetServerSideProps<DashboardProps> = async ({
  req,
  res,
}) => {
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
    props: {
      host: req.headers.host || 'localhost:3000',
    },
  }
}

export default function Dashboard({ host }: DashboardProps) {
  const { data: session, status } = useSession()
  const [adminUsagePage, setAdminUsagePage] = useState(1)
  const [adminDeletionPage, setAdminDeletionPage] = useState(1)
  const [adminFeaturePage, setAdminFeaturePage] = useState(1)
  const [requestingDeletionSlug, setRequestingDeletionSlug] = useState<string | null>(null)
  const [deletionComposerSlug, setDeletionComposerSlug] = useState<string | null>(null)
  const [deletionReasonDraft, setDeletionReasonDraft] = useState('')
  const [deletionFeedback, setDeletionFeedback] = useState<string | null>(null)
  const [adminAlert, setAdminAlert] = useState<AdminAlert | null>(null)
  const [featureRequestDrafts, setFeatureRequestDrafts] = useState<
    Record<string, { status: string; adminResponse: string }>
  >({})
  const { data, error, isLoading, mutate: mutateSlugs } = useSWR<SlugsResponse>(
    '/api/user/slugs',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )
  const { data: adminUsage, mutate: mutateAdminUsage } = useSWR<AdminUsageResponse>(
    status === 'authenticated'
      ? `/api/admin/usage?page=${adminUsagePage}&pageSize=${ADMIN_USAGE_PAGE_SIZE}`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      shouldRetryOnError: false,
    }
  )
  const { data: adminDeletionRequests, mutate: mutateDeletionRequests } =
    useSWR<AdminDeletionRequestsResponse>(
      adminUsage?.stats
        ? `/api/admin/deletion-requests?page=${adminDeletionPage}&pageSize=${ADMIN_DELETION_PAGE_SIZE}`
        : null,
      fetcher,
      {
        revalidateOnFocus: false,
        dedupingInterval: 10000,
        shouldRetryOnError: false,
      }
    )
  const { data: adminFeatureRequests, mutate: mutateFeatureRequests } =
    useSWR<AdminFeatureRequestsResponse>(
      adminUsage?.stats
        ? `/api/admin/feature-requests?page=${adminFeaturePage}&pageSize=${ADMIN_FEATURE_PAGE_SIZE}`
        : null,
      fetcher,
      {
        revalidateOnFocus: false,
        dedupingInterval: 10000,
        shouldRetryOnError: false,
      }
    )

  const slugs = data?.slugs ?? []
  const adminStats = adminUsage?.stats
  const recentRequests = adminUsage?.recentRequests ?? []
  const adminPagination = adminUsage?.pagination
  const adminPage = adminPagination?.page ?? 1
  const adminPageSize = adminPagination?.pageSize ?? ADMIN_USAGE_PAGE_SIZE
  const adminTotalPages = adminPagination?.totalPages ?? 1
  const adminTotalItems = adminPagination?.totalItems ?? 0
  const adminRangeStart = adminTotalItems === 0 ? 0 : (adminPage - 1) * adminPageSize + 1
  const adminRangeEnd = adminTotalItems === 0
    ? 0
    : Math.min(adminPage * adminPageSize, adminTotalItems)
  const deletionRequests = adminDeletionRequests?.requests ?? []
  const deletionPagination = adminDeletionRequests?.pagination
  const featureRequests = adminFeatureRequests?.requests ?? []
  const featurePagination = adminFeatureRequests?.pagination

  const endpointBase =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}`
      : `https://${host}`

  useEffect(() => {
    if (!adminStats) {
      return
    }

    if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_PUSHER_KEY) {
      return
    }

    const pusherClient = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1',
    })

    const channel = pusherClient.subscribe('admin-activity')
    channel.bind('admin-alert', (event: AdminAlert) => {
      setAdminAlert(event)
      mutateAdminUsage()
      mutateDeletionRequests()
      mutateFeatureRequests()
    })

    return () => {
      channel.unbind('admin-alert')
      pusherClient.unsubscribe('admin-activity')
      pusherClient.disconnect()
    }
  }, [adminStats, mutateAdminUsage, mutateDeletionRequests, mutateFeatureRequests])

  const handleDeletionRequest = async (slug: string, reason: string) => {
    const trimmedReason = reason.trim()

    if (trimmedReason.length < 10) {
      setDeletionFeedback('Deletion reason must be at least 10 characters.')
      return
    }

    setRequestingDeletionSlug(slug)
    setDeletionFeedback(null)

    try {
      const response = await fetch(`/api/user/slugs/${slug}/deletion-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: trimmedReason,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to request deletion')
      }

      setDeletionFeedback(
        payload.alreadyRequested
          ? `${slug} already has a pending deletion request.`
          : `${slug} is queued for deletion after the 24-hour reporting hold.`
      )

      await mutateSlugs()
      await mutateDeletionRequests()
      setDeletionComposerSlug(null)
      setDeletionReasonDraft('')
    } catch (requestError: any) {
      setDeletionFeedback(requestError.message || 'Failed to request deletion')
    } finally {
      setRequestingDeletionSlug(null)
    }
  }

  const updateFeatureDraft = (
    requestId: string,
    field: 'status' | 'adminResponse',
    value: string,
    fallbackStatus: string,
    fallbackResponse: string
  ) => {
    setFeatureRequestDrafts((currentDrafts) => ({
      ...currentDrafts,
      [requestId]: {
        status: currentDrafts[requestId]?.status ?? fallbackStatus,
        adminResponse: currentDrafts[requestId]?.adminResponse ?? fallbackResponse,
        [field]: value,
      },
    }))
  }

  const handleFeatureResponseSave = async (request: AdminFeatureRequest) => {
    const draft = featureRequestDrafts[request.id] ?? {
      status: request.status,
      adminResponse: request.adminResponse,
    }

    const response = await fetch(`/api/admin/feature-requests/${request.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(draft),
    })

    const payload = await response.json()

    if (!response.ok) {
      throw new Error(payload.error || 'Failed to update feature request')
    }

    await mutateFeatureRequests()
  }

  return (
    <>
      <Head>
        <title>Callback Handler - My Slugs</title>
        <meta
          name="description"
          content="Dashboard showing your recorded callback handler slugs."
        />
      </Head>

      <div
        className="fixed inset-0 z-[-1]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.95)), url(/records-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      />

      <section className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Text variant="h1">My Slugs</Text>
            <Text className="mt-2 text-sm text-gray-600">
              View the endpoints tied to your account and jump straight into
              their request history.
            </Text>
          </div>
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-black transition-colors inline-flex items-center gap-1"
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
            Back to creator
          </Link>
        </div>

        {status === 'loading' && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
          </div>
        )}

        {status === 'authenticated' && session?.user && (
          <div className="flex items-center gap-3 p-4 border rounded-lg bg-white/80 backdrop-blur-sm shadow-sm">
            {session.user.image && (
              <img
                src={session.user.image}
                alt={session.user.name || 'User'}
                className="w-9 h-9 rounded-full"
              />
            )}
            <div>
              <Text className="text-sm font-semibold">
                {session.user.name || session.user.email}
              </Text>
              <Text className="text-xs text-gray-500">
                {session.user.email}
              </Text>
            </div>
          </div>
        )}

        {adminStats && (
          <div className="p-5 border rounded-lg bg-white/85 backdrop-blur-sm shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <Text variant="h2">Usage Overview</Text>
                <Text className="text-sm text-gray-600 mt-1">
                  Admin view of all tracked request activity across guest and authenticated usage.
                </Text>
              </div>
            </div>

            {adminAlert && (
              <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <div>
                  <Text className="text-sm font-semibold text-amber-950">Live admin alert</Text>
                  <Text className="mt-1 text-sm text-amber-900">
                    {adminAlert.message}
                  </Text>
                  <Text className="mt-1 text-xs text-amber-700">
                    {new Date(adminAlert.timestamp).toLocaleString()}
                  </Text>
                </div>
                <button
                  type="button"
                  onClick={() => setAdminAlert(null)}
                  className="text-xs font-medium text-amber-900 transition-colors hover:text-black"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
              <div className="rounded-lg border bg-gray-50 p-4">
                <Text className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">Total Requests</Text>
                <Text className="text-2xl font-semibold mt-2">{adminStats.totalRequests}</Text>
              </div>
              <div className="rounded-lg border bg-gray-50 p-4">
                <Text className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">Guest Requests</Text>
                <Text className="text-2xl font-semibold mt-2">{adminStats.guestRequests}</Text>
              </div>
              <div className="rounded-lg border bg-gray-50 p-4">
                <Text className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">Authenticated Requests</Text>
                <Text className="text-2xl font-semibold mt-2">{adminStats.authenticatedRequests}</Text>
              </div>
              <div className="rounded-lg border bg-gray-50 p-4">
                <Text className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">Tracked Slugs</Text>
                <Text className="text-2xl font-semibold mt-2">{adminStats.uniqueSlugs}</Text>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="flex flex-col gap-3 border-b bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Text className="text-sm font-semibold">Recent Request Activity</Text>
                  <Text className="mt-1 text-xs text-gray-500">
                    Showing {adminRangeStart}-{adminRangeEnd} of {adminTotalItems}
                  </Text>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setAdminUsagePage((currentPage) => Math.max(1, currentPage - 1))}
                    disabled={adminPage <= 1}
                    className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <div className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600">
                    Page {adminPage} of {adminTotalPages}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setAdminUsagePage((currentPage) => Math.min(adminTotalPages, currentPage + 1))
                    }
                    disabled={adminPage >= adminTotalPages}
                    className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
              {recentRequests.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500">
                  No tracked requests yet.
                </div>
              ) : (
                <div className="divide-y">
                  {recentRequests.map((request) => (
                    <div key={request.id} className="px-4 py-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <Text className="text-sm font-semibold break-all">{request.slug}</Text>
                        <Text className="text-xs text-gray-500 break-all">
                          {request.method} • {request.accessType} • {request.ip}
                          {request.ownerEmail ? ` • ${request.ownerEmail}` : ''}
                        </Text>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{request.responseStatus ?? 200}</span>
                        <span>{new Date(request.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {adminStats && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-lg border bg-white/85 p-5 shadow-sm backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <Text variant="h2">Deletion Requests</Text>
                  <Text className="mt-1 text-sm text-gray-600">
                    Admin-only log of requested slug deletions, reasons, and archive outcomes.
                  </Text>
                </div>
                <div className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600">
                  Page {deletionPagination?.page ?? 1} of {deletionPagination?.totalPages ?? 1}
                </div>
              </div>

              <div className="space-y-3">
                {deletionRequests.length === 0 ? (
                  <div className="rounded-lg border border-dashed px-4 py-5 text-sm text-gray-500">
                    No deletion requests logged yet.
                  </div>
                ) : (
                  deletionRequests.map((request) => (
                    <div key={request.id} className="rounded-lg border bg-gray-50 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Text className="text-sm font-semibold break-all">{request.slug}</Text>
                          <Text className="mt-1 text-xs text-gray-500">
                            Requested by {request.requestedBy?.email || 'unknown'} on{' '}
                            {new Date(request.requestedAt).toLocaleString()}
                          </Text>
                        </div>
                        <span className="rounded-full bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                          {request.status}
                        </span>
                      </div>
                      <div className="mt-3 rounded-md bg-white px-3 py-2 text-sm text-gray-700">
                        {request.reason}
                      </div>
                      <Text className="mt-2 text-[11px] text-gray-500">
                        Eligible after {new Date(request.eligibleAfter).toLocaleString()}
                        {request.archivedAt ? ` • Archived ${new Date(request.archivedAt).toLocaleString()}` : ''}
                      </Text>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setAdminDeletionPage((currentPage) => Math.max(1, currentPage - 1))}
                  disabled={(deletionPagination?.page ?? 1) <= 1}
                  className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAdminDeletionPage((currentPage) =>
                      Math.min(deletionPagination?.totalPages ?? 1, currentPage + 1)
                    )
                  }
                  disabled={(deletionPagination?.page ?? 1) >= (deletionPagination?.totalPages ?? 1)}
                  className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="rounded-lg border bg-white/85 p-5 shadow-sm backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <Text variant="h2">Feature Requests</Text>
                  <Text className="mt-1 text-sm text-gray-600">
                    Admin review queue with GitHub issue links, requester emails, and response notes.
                  </Text>
                </div>
                <div className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600">
                  Page {featurePagination?.page ?? 1} of {featurePagination?.totalPages ?? 1}
                </div>
              </div>

              <div className="space-y-4">
                {featureRequests.length === 0 ? (
                  <div className="rounded-lg border border-dashed px-4 py-5 text-sm text-gray-500">
                    No feature requests yet.
                  </div>
                ) : (
                  featureRequests.map((request) => {
                    const draft = featureRequestDrafts[request.id] ?? {
                      status: request.status,
                      adminResponse: request.adminResponse,
                    }

                    return (
                      <div key={request.id} className="rounded-lg border bg-gray-50 px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <Text className="text-sm font-semibold">{request.title}</Text>
                            <Text className="mt-1 text-xs text-gray-500">
                              {request.requesterName} • {request.requesterEmail} • {new Date(request.createdAt).toLocaleString()}
                            </Text>
                          </div>
                          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                            {request.status}
                          </span>
                        </div>

                        <div className="mt-3 rounded-md bg-white px-3 py-2 text-sm text-gray-700">
                          {request.description}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span>Issue state: {request.githubIssueState}</span>
                          {request.githubIssueUrl && (
                            <a
                              href={request.githubIssueUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-blue-600 hover:text-blue-700"
                            >
                              View issue #{request.githubIssueNumber}
                            </a>
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
                          <select
                            value={draft.status}
                            onChange={(event) =>
                              updateFeatureDraft(
                                request.id,
                                'status',
                                event.target.value,
                                request.status,
                                request.adminResponse
                              )
                            }
                            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-gray-400"
                          >
                            <option value="open">Open</option>
                            <option value="in_review">In review</option>
                            <option value="planned">Planned</option>
                            <option value="blocked">Blocked</option>
                            <option value="closed">Closed</option>
                          </select>
                          <textarea
                            value={draft.adminResponse}
                            onChange={(event) =>
                              updateFeatureDraft(
                                request.id,
                                'adminResponse',
                                event.target.value,
                                request.status,
                                request.adminResponse
                              )
                            }
                            rows={3}
                            placeholder="Add an internal or requester-facing response note."
                            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-gray-400"
                          />
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <Text className="text-[11px] text-gray-500">
                            Updated {new Date(request.updatedAt).toLocaleString()}
                            {request.closedAt ? ` • Closed ${new Date(request.closedAt).toLocaleString()}` : ''}
                          </Text>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await handleFeatureResponseSave(request)
                              } catch (featureError: any) {
                                setDeletionFeedback(featureError.message || 'Failed to update feature request')
                              }
                            }}
                            className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:text-black"
                          >
                            Save response
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setAdminFeaturePage((currentPage) => Math.max(1, currentPage - 1))}
                  disabled={(featurePagination?.page ?? 1) <= 1}
                  className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAdminFeaturePage((currentPage) =>
                      Math.min(featurePagination?.totalPages ?? 1, currentPage + 1)
                    )
                  }
                  disabled={(featurePagination?.page ?? 1) >= (featurePagination?.totalPages ?? 1)}
                  className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-2">
          {isLoading && (
            <Text className="text-sm text-gray-500">
              Loading your slugs...
            </Text>
          )}
          {error && (
            <Text className="text-sm text-red-600">
              Failed to load your slugs.
            </Text>
          )}
          {deletionFeedback && (
            <div className="mt-3 rounded-lg border border-gray-200 bg-white/80 px-4 py-3 text-sm text-gray-700">
              {deletionFeedback}
            </div>
          )}
          {!isLoading && !error && slugs.length === 0 && (
            <div className="mt-4 p-6 border border-dashed rounded-lg bg-white/70 text-sm text-gray-600">
              <Text className="font-semibold text-gray-800 mb-1">
                No slugs yet
              </Text>
              <Text>
                Create a new slug from the home page and visit its record page
                at least once to see it appear here.
              </Text>
            </div>
          )}

          {slugs.length > 0 && (
            <div className="mt-4">
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Deletion requests are held for at least 24 hours before archival and removal so reporting can finish and audit records can be staged.
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {slugs.map(({ slug, createdAt, deletionRequestedAt, deletionEligibleAfter, deletionStatus, deletionReason }) => {
                let createdLabel = 'Unknown'
                if (createdAt) {
                  const d = new Date(createdAt)
                  if (!Number.isNaN(d.getTime())) {
                    createdLabel = d.toLocaleString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: '2-digit',
                    })
                  }
                }

                const isDeletionPending = deletionStatus === 'pending'
                const deletionRequestedLabel = deletionRequestedAt
                  ? new Date(deletionRequestedAt).toLocaleString()
                  : null
                const deletionEligibleLabel = deletionEligibleAfter
                  ? new Date(deletionEligibleAfter).toLocaleString()
                  : null

                return (
                  <div
                    key={slug}
                    className="group rounded-lg border bg-white/80 p-4 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Text className="text-sm font-semibold break-all">
                          {slug}
                        </Text>
                        {isDeletionPending && (
                          <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                            Deletion requested
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/record/${slug}`}
                        className="inline-flex items-center justify-center rounded-full bg-gray-900 text-xs text-white transition-colors group-hover:bg-black h-6 w-6"
                      >
                        →
                      </Link>
                    </div>
                    <div className="text-xs text-gray-500 break-all">
                      <span className="uppercase tracking-wide font-semibold text-[10px]">
                        Endpoint
                      </span>
                      <div className="mt-1">
                        <Code>
                          {endpointBase}/record/{slug}
                        </Code>
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] text-gray-400">
                      <span className="mr-1 uppercase tracking-wide font-semibold text-[9px]">
                        Created
                      </span>
                      <span>{createdLabel}</span>
                    </div>
                    {isDeletionPending && (
                      <div className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
                        Requested {deletionRequestedLabel}
                        {deletionEligibleLabel ? ` • Eligible after ${deletionEligibleLabel}` : ''}
                        {deletionReason ? ` • Reason: ${deletionReason}` : ''}
                      </div>
                    )}
                    {!isDeletionPending && deletionComposerSlug === slug ? (
                      <div className="mt-4 rounded-lg border border-red-200 bg-red-50/70 p-3">
                        <label className="block text-[11px] font-semibold uppercase tracking-wide text-red-800">
                          Reason for deletion
                        </label>
                        <textarea
                          value={deletionReasonDraft}
                          onChange={(event) => setDeletionReasonDraft(event.target.value)}
                          rows={3}
                          placeholder="Tell us why this slug should be deleted."
                          className="mt-2 w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition-colors focus:border-red-400"
                        />
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <Text className="text-[11px] text-red-700">
                            This request is logged for admins and processed after the 24-hour hold.
                          </Text>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setDeletionComposerSlug(null)
                                setDeletionReasonDraft('')
                              }}
                              className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:text-black"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletionRequest(slug, deletionReasonDraft)}
                              disabled={requestingDeletionSlug === slug}
                              className="inline-flex items-center rounded-md border border-red-200 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {requestingDeletionSlug === slug ? 'Submitting...' : 'Submit request'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <Text className="text-[11px] text-gray-500">
                          {isDeletionPending
                            ? 'Pending archival and deletion'
                            : 'Request deletion when you are done with this slug'}
                        </Text>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletionComposerSlug(slug)
                            setDeletionReasonDraft('')
                          }}
                          disabled={isDeletionPending || requestingDeletionSlug === slug}
                          className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {requestingDeletionSlug === slug
                            ? 'Submitting...'
                            : isDeletionPending
                              ? 'Deletion queued'
                              : 'Request deletion'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
