'use client'

/**
 * Cloudflare Turnstile widget wrapper.
 *
 * Required env var: NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * Get it from: Cloudflare Dashboard → Turnstile → Add Site → Site Key
 *
 * Usage:
 *   <TurnstileWidget onVerify={(token) => setTurnstileToken(token)} />
 *
 * Pass the received `token` as `cf-turnstile-response` in your POST body.
 */

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void
  onExpire?: () => void
  onError?: () => void
  className?: string
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

export function TurnstileWidget({ onVerify, onExpire, onError, className }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!SITE_KEY) {
      // Dev without Turnstile configured — inject a dummy token so forms still work
      console.warn('[Turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY not set — skipping widget')
      onVerify('dev-bypass')
      return
    }

    function renderWidget() {
      if (!containerRef.current || !window.turnstile) return
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: onVerify,
        'expired-callback': () => {
          onExpire?.()
        },
        'error-callback': () => {
          onError?.()
        },
      })
    }

    // If script already loaded
    if (window.turnstile) {
      renderWidget()
      return
    }

    // Inject script once
    const existing = document.querySelector('script[src*="turnstile"]')
    if (!existing) {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      script.async = true
      script.defer = true
      script.onload = renderWidget
      document.head.appendChild(script)
    } else {
      existing.addEventListener('load', renderWidget)
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!SITE_KEY) return null

  return <div ref={containerRef} className={className} />
}
