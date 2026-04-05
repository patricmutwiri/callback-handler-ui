import Link from 'next/link'
import { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-[90vw] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-[68px] flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src="/logo.png" alt="Callback Handler" className="w-20 h-20" />
              <span className="font-semibold text-lg">Callback Handler</span>
            </Link>

            <nav className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Link
                href="/feature-requests"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                <span>Feature Requests</span>
              </Link>
              <Link
                href="/support"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 21s-6.716-4.35-9.428-8.057C.84 10.598 1.455 7.19 4.22 5.582c2.057-1.196 4.373-.69 5.78.942 1.407-1.632 3.723-2.138 5.78-.942 2.765 1.608 3.38 5.016 1.648 7.361C18.716 16.65 12 21 12 21Z" />
                </svg>
                <span>Support Us</span>
              </Link>
              <a
                href="https://github.com/patricmutwiri/callback-handler-ui"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <span>GitHub</span>
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[90vw] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {children}
      </main>

      {/* Footer Links */}
      <footer className="border-t border-gray-200 bg-white py-4">
        <div className="max-w-[90vw] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 text-sm text-gray-600">
            <Link href="/privacy" className="hover:text-black transition-colors">
              Privacy Policy
            </Link>
            <span className="hidden sm:inline">•</span>
            <Link href="/support" className="hover:text-black transition-colors">
              Support Us
            </Link>
            <span className="hidden sm:inline">•</span>
            <Link href="/feature-requests" className="hover:text-black transition-colors">
              Feature Requests
            </Link>
            <span className="hidden sm:inline">•</span>
            <a
              href="https://github.com/patricmutwiri/callback-handler-ui"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-black transition-colors"
            >
              GitHub Repository
            </a>
            <span className="hidden sm:inline">•</span>
            <a
              href="https://github.com/patricmutwiri"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-black transition-colors"
            >
              Works by Patrick Mutwiri
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
