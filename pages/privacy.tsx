import { Text } from '@vercel/examples-ui'
import Head from 'next/head'
import Link from 'next/link'

export default function PrivacyPolicy() {
  return (
    <>
      <Head>
        <title>Callback Handler - Privacy Policy</title>
        <meta name="description" content="Privacy Policy for Callback Handler" />
        <meta property="og:title" content="Callback Handler - Privacy Policy" />
        <meta property="og:description" content="Privacy Policy" />
        <meta property="og:image" content="https://callback-handler-ui.vercel.app/logo.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://callback-handler-ui.vercel.app/logo.png" />
      </Head>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link href="/" className="text-sm text-gray-500 hover:text-black transition-colors inline-flex items-center gap-1 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Home
          </Link>
          <Text variant="h1">Privacy Policy</Text>
          <Text className="text-gray-600 mt-2">Last updated: {new Date().toLocaleDateString()}</Text>
        </div>

        <div className="prose prose-sm max-w-none space-y-6">
          <section>
            <Text variant="h2">1. Introduction</Text>
            <Text>
              Callback Handler ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our webhook testing and callback inspection service.
            </Text>
          </section>

          <section>
            <Text variant="h2">2. Information We Collect</Text>
            <Text className="font-semibold mb-2">2.1 Authentication Information</Text>
            <Text>
              When you sign in using OAuth providers (GitHub, Google, or Facebook), we collect:
            </Text>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your email address</li>
              <li>Your name (if provided)</li>
              <li>Your profile picture (if provided)</li>
              <li>Your provider account ID</li>
            </ul>

            <Text className="font-semibold mb-2 mt-4">2.2 Webhook Data</Text>
            <Text>
              When you use our service to capture HTTP requests, we store:
            </Text>
            <ul className="list-disc pl-6 space-y-1">
              <li>HTTP request headers</li>
              <li>Request body/payload</li>
              <li>HTTP method (GET, POST, etc.)</li>
              <li>Request timestamp</li>
              <li>IP address of the requester</li>
              <li>Query parameters</li>
            </ul>
          </section>

          <section>
            <Text variant="h2">3. How We Use Your Information</Text>
            <Text>We use the collected information to:</Text>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Provide and maintain our webhook testing service</li>
              <li>Authenticate your identity when you sign in</li>
              <li>Store and display captured HTTP requests for your inspection</li>
              <li>Send you real-time updates about incoming requests</li>
              <li>Improve our service and user experience</li>
            </ul>
          </section>

          <section>
            <Text variant="h2">4. Data Storage</Text>
            <Text>
              Your data is stored using Vercel KV (Redis) infrastructure. We retain:
            </Text>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Captured HTTP requests for up to 30 days</li>
              <li>User account information while your account is active</li>
              <li>Only the last 100 requests per webhook endpoint</li>
            </ul>
            <Text className="mt-2">
              Data older than 30 days is automatically deleted. You can delete your data at any time by removing your webhook endpoints.
            </Text>
          </section>

          <section>
            <Text variant="h2">5. Third-Party Services</Text>
            <Text className="font-semibold mb-2">5.1 OAuth Providers</Text>
            <Text>
              We use OAuth authentication through GitHub, Google, and Facebook. These services have their own privacy policies governing the use of your information. We only receive the information you authorize us to access.
            </Text>

            <Text className="font-semibold mb-2 mt-4">5.2 Pusher</Text>
            <Text>
              We use Pusher for real-time updates. Pusher may collect technical information about your connection. Please review Pusher's privacy policy for more information.
            </Text>

            <Text className="font-semibold mb-2 mt-4">5.3 Vercel</Text>
            <Text>
              Our service is hosted on Vercel. Vercel processes your data according to their privacy policy and terms of service.
            </Text>
          </section>

          <section>
            <Text variant="h2">6. Cookies and Sessions</Text>
            <Text>
              We use session cookies to maintain your authentication state. These cookies are essential for the service to function and are automatically deleted when you sign out or after a period of inactivity.
            </Text>
          </section>

          <section>
            <Text variant="h2">7. Data Security</Text>
            <Text>
              We implement reasonable security measures to protect your information. However, no method of transmission over the internet is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.
            </Text>
          </section>

          <section>
            <Text variant="h2">8. Your Rights</Text>
            <Text>You have the right to:</Text>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Access your personal information</li>
              <li>Delete your account and associated data</li>
              <li>Request correction of inaccurate information</li>
              <li>Opt out of certain data collection (by not using the service)</li>
            </ul>
            <Text className="mt-2">
              To exercise these rights, please contact us using the information provided below.
            </Text>
          </section>

          <section>
            <Text variant="h2">9. Children's Privacy</Text>
            <Text>
              Our service is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
            </Text>
          </section>

          <section>
            <Text variant="h2">10. Changes to This Privacy Policy</Text>
            <Text>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
            </Text>
          </section>

          <section>
            <Text variant="h2">11. Contact Us</Text>
            <Text>
              If you have any questions about this Privacy Policy, please contact us via GitHub issues.
            </Text>
          </section>
        </div>
      </div>
    </>
  )
}
