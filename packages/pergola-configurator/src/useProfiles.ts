'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ProfileMeta } from './types'
import { dimsToCm } from './utils'
import { useConfiguratorRuntime } from './runtime-context'

export function useProfiles() {
  const { resourceBaseUrl, profilesJsonUrl } = useConfiguratorRuntime()
  const [profiles, setProfiles] = useState<ProfileMeta[]>([])
  const [profilesLoading, setProfilesLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setProfilesLoading(true)
    const profilesUrl =
      profilesJsonUrl !== undefined && profilesJsonUrl !== ''
        ? profilesJsonUrl
        : resourceBaseUrl !== ''
          ? `${resourceBaseUrl}/data/profiles.json`
          : '/data/profiles.json'
    fetch(profilesUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load profiles: ${r.status}`)
        return r.json()
      })
      .then((j) => {
        if (!cancelled) {
          const loadedProfiles = Array.isArray(j?.profiles) ? j.profiles : []
          setProfiles(loadedProfiles)
          setProfilesLoading(false)
        }
      })
      .catch((err) => {
        console.error('Failed to load profiles:', err)
        if (!cancelled) {
          setProfiles([])
          setProfilesLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [resourceBaseUrl, profilesJsonUrl])

  const candidates = useMemo(() => {
    const parsed = profiles.map((p) => {
      const dims = dimsToCm(p.dimensions as string | undefined)
      return { p, dims }
    })
    return parsed as Array<{ p: ProfileMeta; dims: { a: number; b: number } | null }>
  }, [profiles])

  useEffect(() => {
    if (profiles.length > 0 && candidates.length > 0) {
      const beamExists = candidates.some((c) => c.p.id === 'f10040' && c.dims)
      const lamellaExists = candidates.some((c) => c.p.id === 'f10020' && c.dims)
      if (!beamExists) {
        console.warn('Default beam profile f10040 not found or has no dimensions in profiles.json')
      }
      if (!lamellaExists) {
        console.warn('Default lamella profile f10020 not found or has no dimensions in profiles.json')
      }
    }
  }, [profiles, candidates])

  return { profiles, profilesLoading, candidates }
}
