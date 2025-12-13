'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Script from 'next/script'

declare global {
  interface Window {
    gtag: (...args: any[]) => void
    dataLayer: any[]
  }
}

export default function GA() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const gaId = process.env.NEXT_PUBLIC_GA_ID

  useEffect(() => {
    if (!gaId || typeof window === 'undefined') return
    
    // Initialize dataLayer if it doesn't exist
    if (!window.dataLayer) {
      window.dataLayer = []
    }
    
    // Define gtag function if it doesn't exist
    if (!window.gtag) {
      window.gtag = function() {
        window.dataLayer.push(arguments)
      }
    }
  }, [])

  useEffect(() => {
    if (!gaId || typeof window === 'undefined' || !window.gtag) return
    
    // Send page_view on route change
    const pagePath = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '')
    window.gtag('config', gaId, {
      page_path: pagePath,
    })
  }, [pathname, searchParams, gaId])

  if (!gaId) {
    return null
  }

  return (
    <>
      {/* Google tag (gtag.js) - Load in head */}
      <Script
        id="google-analytics-gtag"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
      />
      <Script
        id="google-analytics-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaId}', {
              page_path: window.location.pathname,
            });
          `,
        }}
      />
    </>
  )
}


