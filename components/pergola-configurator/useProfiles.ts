'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ProfileMeta } from './types'
import { dimsToCm } from './utils'

export function useProfiles() {
  const [profiles, setProfiles] = useState<ProfileMeta[]>([])
  const [profilesLoading, setProfilesLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setProfilesLoading(true)
    fetch('/data/profiles.json')
      .then(r => {
        if (!r.ok) throw new Error(`Failed to load profiles: ${r.status}`)
        return r.json()
      })
      .then(j => { 
        if (!cancelled) {
          const loadedProfiles = Array.isArray(j?.profiles) ? j.profiles : []
          setProfiles(loadedProfiles)
          setProfilesLoading(false)
          if (loadedProfiles.length > 0) {
            console.log(`Loaded ${loadedProfiles.length} profiles from /data/profiles.json`)
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load profiles:', err)
        if (!cancelled) {
          setProfiles([])
          setProfilesLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  const candidates = useMemo(() => {
    const parsed = profiles.map(p => {
      const dims = dimsToCm(p.dimensions)
      return { p, dims }
    })
    // Include all profiles, even if dimensions couldn't be parsed
    // Profiles without dimensions will use fallback values when selected
    return parsed as Array<{ p: ProfileMeta; dims: { a: number; b: number } | null }>
  }, [profiles])

  // Verify default profiles exist when profiles are loaded
  useEffect(() => {
    if (profiles.length > 0 && candidates.length > 0) {
      const beamExists = candidates.some(c => c.p.id === 'f10040' && c.dims)
      const lamellaExists = candidates.some(c => c.p.id === 'f10020' && c.dims)
      if (!beamExists) {
        console.warn('Default beam profile f10040 not found or has no dimensions in profiles.json')
      }
      if (!lamellaExists) {
        console.warn('Default lamella profile f10020 not found or has no dimensions in profiles.json')
      }
      console.log(`Loaded ${candidates.length} profiles (${candidates.filter(c => c.dims).length} with dimensions)`)
    }
  }, [profiles, candidates])

  return { profiles, profilesLoading, candidates }
}

