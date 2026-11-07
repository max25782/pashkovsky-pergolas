/**
 * Single source of truth for whether the /new lead form talks to the real backend.
 *
 * Fail-closed: demo is the default. Real sending needs ALL of:
 *   1. NEXT_PUBLIC_LEADS_DEMO === 'false'  (build-time flag, visible to the browser)
 *   2. LEADS_REAL_ENABLED === 'true'       (server-only flag)
 *   3. VERCEL_ENV === 'production'         (never true on Preview or locally)
 * The client only checks (1) to decide whether to call /api/leads at all; the API route
 * re-checks all three, so a Preview deployment can never forward a lead to the CRM.
 */

export interface LeadModeEnv {
  demoFlag: string | undefined
  realEnabled: string | undefined
  vercelEnv: string | undefined
}

/** Client-safe: reads only the public flag. */
export function isLeadDemo(demoFlag: string | undefined = process.env.NEXT_PUBLIC_LEADS_DEMO): boolean {
  return demoFlag !== 'false'
}

/** Server-only: all three conditions must hold. */
export function canSendRealLeads(env: LeadModeEnv): boolean {
  return env.demoFlag === 'false' && env.realEnabled === 'true' && env.vercelEnv === 'production'
}

export function readLeadModeEnv(): LeadModeEnv {
  return {
    demoFlag: process.env.NEXT_PUBLIC_LEADS_DEMO,
    realEnabled: process.env.LEADS_REAL_ENABLED,
    vercelEnv: process.env.VERCEL_ENV,
  }
}
