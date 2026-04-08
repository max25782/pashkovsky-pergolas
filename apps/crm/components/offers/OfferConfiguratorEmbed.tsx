'use client'

import dynamic from 'next/dynamic'
import { useCallback, useImperativeHandle, useMemo, forwardRef } from 'react'
import type { Locale } from '@/lib/locales'
import { authFetch } from '@/lib/api/auth-fetch'
import type { ConfiguratorLocale, CustomSavePayload } from '@pashkovsky/pergola-configurator'
import { offerToConfiguratorInitialParams } from '@/lib/offers/offer-to-configurator-params'
import type { Offer } from '@/types/offer'

const Pergola3D = dynamic(
  () => import('@pashkovsky/pergola-configurator').then((m) => m.Pergola3D),
  { ssr: false, loading: () => <div className="h-[min(70vh,560px)] min-h-[480px] rounded-xl bg-white/10 animate-pulse" /> },
)

function extractCtFromEditUrl(editUrl: string | undefined): string | undefined {
  if (!editUrl) return undefined
  try {
    const u = new URL(editUrl)
    const ct = u.searchParams.get('ct')
    return ct?.trim() || undefined
  } catch {
    return undefined
  }
}

export interface OfferConfiguratorEmbedHandle {
  /** Captures the current 3D canvas as a PNG data URL. Returns null if 3D is not mounted. */
  captureScreenshot: () => string | null
}

interface OfferConfiguratorEmbedProps {
  offerId: string
  locale: Locale
  /** From configurator-link response (full edit URL with ct=) */
  editUrl?: string | null
  /** Optional: seed from saved offer dimensions */
  offer?: Offer | null
  onSaved?: () => void
}

export const OfferConfiguratorEmbed = forwardRef<OfferConfiguratorEmbedHandle, OfferConfiguratorEmbedProps>(
function OfferConfiguratorEmbed({
  offerId,
  locale,
  editUrl,
  offer,
  onSaved,
}, ref) {
  useImperativeHandle(ref, () => ({
    captureScreenshot: () => {
      const fn = (globalThis as { __capturePergolaScreenshot?: () => string }).__capturePergolaScreenshot
      return fn ? fn() : null
    },
  }))

  const siteBase = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
  const linkToken = useMemo(() => extractCtFromEditUrl(editUrl ?? undefined), [editUrl])
  const initialParams = useMemo(
    () => (offer ? offerToConfiguratorInitialParams(offer) : undefined),
    [offer],
  )

  const onCustomSave = useCallback(
    async (payload: CustomSavePayload) => {
      const { screenshot, linkToken: _lt, ...rest } = payload
      const res = await authFetch(`/api/offers/${offerId}/configurator-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rest,
          screenshot,
          locale,
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      onSaved?.()
    },
    [offerId, locale, onSaved],
  )

  if (!siteBase) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-4 text-amber-100 text-sm">
        הגדר NEXT_PUBLIC_SITE_URL — ה-CRM משתמש בו לפרוקסי של profiles/prefill מהאתר (שיווק) ולקישורי
        קונפיגורטור ללקוח.
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <Pergola3D
        locale={locale as ConfiguratorLocale}
        linkToken={linkToken}
        readOnly={false}
        resourceBaseUrl=""
        profilesJsonUrl="/api/configurator/profiles"
        initialParams={initialParams}
        onCustomSave={onCustomSave}
      />
    </div>
  )
})
