'use client'
import { useEffect } from 'react'

export default function UTMTracker() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const utmSource = params.get('utm_source')
    if (utmSource) {
      localStorage.setItem('lead_source', utmSource)
    }
  }, [])
  return null
}

