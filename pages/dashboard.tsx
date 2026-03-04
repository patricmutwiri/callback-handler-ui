import { Code, Text } from '@vercel/examples-ui'
import { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth'
import { useSession } from 'next-auth/react'
import Head from 'next/head'
import Link from 'next/link'
import useSWR from 'swr'
import { authOptions } from './api/auth/[...nextauth]'

interface DashboardProps {
  host: string
}

interface SlugsResponse {
  slugs: string[]
  error?: string
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

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
  const { data, error, isLoading } = useSWR<SlugsResponse>(
    '/api/user/slugs',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )

  const slugs = data?.slugs ?? []

  const endpointBase =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}`
      : `https://${host}`

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
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {slugs.map((slug) => (
                <Link
                  key={slug}
                  href={`/record/${slug}`}
                  className="group p-4 border rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Text className="text-sm font-semibold break-all">
                      {slug}
                    </Text>
                    <span className="inline-flex items-center justify-center rounded-full bg-gray-900 text-white w-6 h-6 text-xs group-hover:bg-black">
                      →
                    </span>
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
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}

