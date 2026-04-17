/** Legacy single-key flag (pre per-company); ignored for new reads unless migrated manually. */
export const CRM_ONBOARDING_LEGACY_KEY = 'crm_onboarding_v1'

/**
 * JSON map: composite key `${userId}:${companyId}` → true when onboarding finished for that pair.
 * Each company (and each registered user) has their own completion flag.
 */
export const CRM_ONBOARDING_MAP_KEY = 'crm_onboarding_map_v1'

export function onboardingCompositeKey(userId: string, companyId: string): string {
  return `${userId}:${companyId}`
}

export function readOnboardingDone(userId: string, companyId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem(CRM_ONBOARDING_MAP_KEY)
    if (!raw) return false
    const map = JSON.parse(raw) as Record<string, boolean>
    return map[onboardingCompositeKey(userId, companyId)] === true
  } catch {
    return false
  }
}

export function writeOnboardingDone(userId: string, companyId: string): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(CRM_ONBOARDING_MAP_KEY)
    const map = (raw ? (JSON.parse(raw) as Record<string, boolean>) : {}) ?? {}
    map[onboardingCompositeKey(userId, companyId)] = true
    localStorage.setItem(CRM_ONBOARDING_MAP_KEY, JSON.stringify(map))
  } catch {
    /* ignore quota / private mode */
  }
}

/** Preserve onboarding progress across selective logout (see admin page). */
export function snapshotOnboardingLocalStorage(): Record<string, string> {
  const out: Record<string, string> = {}
  if (typeof window === 'undefined') return out
  try {
    const legacy = localStorage.getItem(CRM_ONBOARDING_LEGACY_KEY)
    if (legacy != null) out[CRM_ONBOARDING_LEGACY_KEY] = legacy
    const map = localStorage.getItem(CRM_ONBOARDING_MAP_KEY)
    if (map != null) out[CRM_ONBOARDING_MAP_KEY] = map
  } catch {
    /* ignore */
  }
  return out
}

export function restoreOnboardingLocalStorage(snapshot: Record<string, string>): void {
  if (typeof window === 'undefined') return
  try {
    for (const [k, v] of Object.entries(snapshot)) {
      localStorage.setItem(k, v)
    }
  } catch {
    /* ignore */
  }
}
