'use client'

import { useCallback, useEffect, useState } from 'react'
import { EMPTY_FIRM_PROFILE, hasWhatsApp, type FirmProfile } from '@/lib/company/firm-profile'

interface CompanyMeResponse {
  profile?: FirmProfile
}

// One request per page load, shared by every button that needs the firm's contacts.
let cached: FirmProfile | null = null
let inflight: Promise<FirmProfile> | null = null

async function fetchProfile(): Promise<FirmProfile> {
  const res = await fetch('/api/companies/me')
  if (!res.ok) throw new Error(`companies/me ${res.status}`)
  const data = (await res.json()) as CompanyMeResponse
  return data.profile ?? EMPTY_FIRM_PROFILE
}

function loadProfile(): Promise<FirmProfile> {
  if (cached) return Promise.resolve(cached)
  inflight ??= fetchProfile()
    .then((profile) => {
      cached = profile
      return profile
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Forget the cached profile (call after the settings page saved a change). */
export function resetFirmProfileCache(): void {
  cached = null
}

export interface UseFirmProfile {
  profile: FirmProfile
  isReady: boolean
  /** False until the profile is loaded: WhatsApp stays hidden rather than flashing. */
  hasWhatsApp: boolean
}

export function useFirmProfile(): UseFirmProfile {
  const [profile, setProfile] = useState<FirmProfile>(cached ?? EMPTY_FIRM_PROFILE)
  const [isReady, setIsReady] = useState(cached !== null)

  const load = useCallback(() => {
    let cancelled = false
    loadProfile()
      .then((next) => {
        if (cancelled) return
        setProfile(next)
        setIsReady(true)
      })
      .catch((error: unknown) => {
        console.error('[useFirmProfile] load failed', error)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => load(), [load])

  return { profile, isReady, hasWhatsApp: hasWhatsApp(profile) }
}
