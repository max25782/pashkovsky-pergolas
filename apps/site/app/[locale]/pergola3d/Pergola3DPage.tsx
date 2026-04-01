'use client'

import { useEffect, useState } from 'react'
import type { Locale } from '@/lib/locales'
import { Pergola3D } from '@pashkovsky/pergola-configurator'

interface Pergola3DPageProps {
  locale: Locale
  linkToken?: string
  readOnly: boolean
}

/**
 * WebGL / R3F must not run during SSR. Gate on mount and import Pergola3D statically so the
 * route shares one client bundle with the rest of the app (no separate dynamic chunk 404 / dual toast context).
 */
export function Pergola3DPage({ locale, linkToken, readOnly }: Pergola3DPageProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div
        className="w-full flex-1 animate-pulse bg-neutral-200"
        aria-hidden
      />
    )
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <Pergola3D locale={locale} linkToken={linkToken} readOnly={readOnly} />
    </div>
  )
}
