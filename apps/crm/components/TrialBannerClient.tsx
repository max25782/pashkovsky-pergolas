'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface TrialBannerClientProps {
  daysLeft: number
  isEarlyBird: boolean
  earlyBirdPosition: number | null
}

const DISMISS_KEY = 'trial_banner_dismissed_until'

export function TrialBannerClient({ daysLeft, isEarlyBird, earlyBirdPosition }: TrialBannerClientProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const dismissedUntil = window.localStorage.getItem(DISMISS_KEY)
    if (dismissedUntil) {
      const ts = parseInt(dismissedUntil, 10)
      if (!Number.isNaN(ts) && ts > Date.now()) return
    }
    setVisible(true)
  }, [])

  if (!visible) return null

  function dismiss() {
    // Snooze for 24 hours
    const until = Date.now() + 24 * 60 * 60 * 1000
    window.localStorage.setItem(DISMISS_KEY, String(until))
    setVisible(false)
  }

  const urgent = daysLeft <= 2
  const wrapperClass = urgent
    ? 'bg-gradient-to-r from-red-600/15 via-orange-600/15 to-red-600/15 border-red-500/40'
    : isEarlyBird
      ? 'bg-gradient-to-r from-amber-600/15 via-orange-600/15 to-amber-600/15 border-amber-500/40'
      : 'bg-gradient-to-r from-violet-600/15 via-purple-600/15 to-violet-600/15 border-violet-500/40'

  const dayLabel = daysLeft === 1 ? 'day' : 'days'
  const headline = isEarlyBird
    ? `Early Bird trial ends in ${daysLeft} ${dayLabel}${earlyBirdPosition ? ` (spot #${earlyBirdPosition})` : ''}`
    : `Your trial ends in ${daysLeft} ${dayLabel}`

  const subline = isEarlyBird
    ? 'You currently have full access to every feature. Upgrade to keep it after the trial.'
    : 'Upgrade now to unlock all features and keep your data.'

  return (
    <div className={`relative border-b ${wrapperClass}`}>
      <div className="max-w-7xl mx-auto flex items-center gap-3 px-4 py-2.5 sm:px-6">
        <span className="text-lg shrink-0" aria-hidden="true">
          {urgent ? '⏰' : isEarlyBird ? '⚡' : '⏳'}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{headline}</p>
          <p className="text-xs text-white/70 truncate">{subline}</p>
        </div>
        <Link
          href="/app/settings/subscription"
          className="shrink-0 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-lg bg-white text-black hover:bg-white/90 transition-colors"
        >
          Upgrade
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 p-1 text-white/60 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
