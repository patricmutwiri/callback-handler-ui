import Link from 'next/link'
import { ReactNode } from 'react'
import PaypalButton from './PaypalButton'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src="/logo.png" alt="Callback Handler" className="w-20 h-20" />
              <span className="font-semibold text-lg">Callback Handler</span>
            </Link>
            
            <a
              href="https://github.com/patricmutwiri/callback-handler-ui"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-600 hover:text-black transition-colors"
            >
              GitHub →
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="bg-white flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {children}
      </main>

      {/* Footer */}
      <PaypalButton />
    </div>
  )
}
