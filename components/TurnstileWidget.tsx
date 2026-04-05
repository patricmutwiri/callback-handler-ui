/**
 * Project Name: Callback Handler UI
 * Author: Patrick Mutwiri <dev@patric.xyz>
 * Author URL: https://github.com/patricmutwiri
 * Date: 2026-04-05
 */

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          action?: string
          callback: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
        }
      ) => string
      remove: (widgetId: string) => void
    }
  }
}

interface TurnstileWidgetProps {
  action?: string
  onTokenChange: (token: string | null) => void
  resetKey?: number
  siteKey: string
}

export default function TurnstileWidget({
  action,
  onTokenChange,
  resetKey = 0,
  siteKey,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)

  useEffect(() => {
    if (!scriptLoaded || !siteKey || !containerRef.current || !window.turnstile) {
      return
    }

    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current)
      widgetIdRef.current = null
    }

    onTokenChange(null)

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      callback: (token) => onTokenChange(token),
      'expired-callback': () => onTokenChange(null),
      'error-callback': () => onTokenChange(null),
    })

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [action, onTokenChange, resetKey, scriptLoaded, siteKey])

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
      <div ref={containerRef} className="min-h-[65px]" />
    </>
  )
}
