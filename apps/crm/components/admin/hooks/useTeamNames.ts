import { useEffect, useState } from 'react'

/** Company members' display names keyed by user id (for deals.created_by). */
export function useTeamNames(): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/companies/members')
        if (!res.ok) {
          console.error('[useTeamNames] members request failed:', res.status)
          return
        }
        const data = (await res.json()) as { names?: Record<string, string> }
        if (!cancelled) setNames(data.names ?? {})
      } catch (e) {
        console.error('[useTeamNames] Load error:', e)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return names
}
