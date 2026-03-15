'use client'

import { useEffect, useState } from 'react'

/**
 * Fetches current company name from /api/companies/me.
 * Used for WhatsApp greeting and other company-branded content.
 */
export function useCompanyName(): string {
  const [name, setName] = useState<string>('Pashkovsky Group')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/companies/me')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data.company_name) {
          setName(data.company_name)
        }
      } catch {
        // Keep default
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return name
}
