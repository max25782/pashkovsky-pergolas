/**
 * Guard for tests that talk to a real Supabase project or a real HTTP server.
 *
 * Why it exists: these suites create and delete companies, auth users, deals and
 * offer-number counters with the service-role key. Run with the production URL in the
 * shell environment, they wrote to production. The rules are:
 *
 *   - the target host must be localhost, 127.0.0.1 or ::1, otherwise the suite fails
 *     while it is being defined, before any network call;
 *   - without configuration the suite is skipped with an explanation, it never fails
 *     on import;
 *   - nothing here reads .env files: the variables must be set on purpose.
 */

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

/** Hosted Supabase domains. No test may reach them, whatever the configuration says. */
const REMOTE_SUPABASE_HOST = /(^|\.)supabase\.(co|in|net)$/i

export class NonLocalTargetError extends Error {
  constructor(label: string) {
    super(
      `Refusing to run: ${label} points to a host that is not localhost, 127.0.0.1 or ::1. ` +
        'Integration tests write data and must never run against a shared or production project.',
    )
    this.name = 'NonLocalTargetError'
  }
}

export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function isLocalUrl(url: string): boolean {
  const host = hostnameOf(url)
  return host !== null && LOCAL_HOSTNAMES.has(host)
}

export function assertLocalUrl(url: string, label: string): void {
  if (!isLocalUrl(url)) throw new NonLocalTargetError(label)
}

export interface IntegrationEnv {
  url: string
  serviceKey: string
}

export const SUPABASE_URL_VARIABLES = ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'] as const

/**
 * Reads the Supabase test configuration. Returns null when it is not configured.
 * Throws NonLocalTargetError when any configured Supabase URL is not local, even if the
 * other one is, so a stray production value cannot slip through.
 */
export function readIntegrationEnv(env: NodeJS.ProcessEnv = process.env): IntegrationEnv | null {
  for (const name of SUPABASE_URL_VARIABLES) {
    const value = env[name]
    if (value !== undefined && value !== '') assertLocalUrl(value, name)
  }
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return { url, serviceKey }
}

export const SKIP_MESSAGE_SUPABASE =
  'skipped: set SUPABASE_URL (a local Supabase, e.g. http://127.0.0.1:54321) and SUPABASE_SERVICE_ROLE_KEY to run this suite'

export const SKIP_MESSAGE_HTTP =
  'skipped: set TEST_API_URL to a local server (e.g. http://localhost:3000) to run this suite'

/** Test API base URL. Null when not set; throws when set to a non-local address. */
export function readTestApiUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env.TEST_API_URL
  if (value === undefined || value === '') return null
  assertLocalUrl(value, 'TEST_API_URL')
  return value
}

/** The URL a fetch call is about to hit, or null when it cannot be determined. */
export function fetchTargetUrl(input: unknown): string | null {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  if (typeof input === 'object' && input !== null && 'url' in input) {
    const url = (input as { url: unknown }).url
    return typeof url === 'string' ? url : null
  }
  return null
}

/** Throws when a fetch call would reach a hosted Supabase project. */
export function assertFetchAllowed(input: unknown): void {
  const target = fetchTargetUrl(input)
  if (target === null) return
  const host = hostnameOf(target)
  if (host !== null && REMOTE_SUPABASE_HOST.test(host)) {
    throw new NonLocalTargetError('a fetch call')
  }
}
