'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function GA() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  useEffect(() => {
    const id = process.env.NEXT_PUBLIC_GA_ID
    if (!id) return
    // send page_view on route change
    if (typeof window !== 'undefined' && 'gtag' in window) {
      // @ts-ignore
      window.gtag('config', id, { page_path: pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '') })
    }
  }, [pathname, searchParams])
  return null
}


