/**
 * Bounded-timeout `fetch` for Supabase clients — see incident
 * `GET /api/companies/me 401 in 1084724ms` (~18 minutes): supabase-js's
 * default fetch (undici in Node) has NO timeout of its own, so a stalled
 * connection to Supabase (half-open TCP after an `ECONNRESET`-style network
 * hiccup) is only ever cut off by the OS's own TCP retransmission/keepalive
 * timers — which can be tens of minutes, not seconds. The auth call
 * eventually failed (hence the real "401", not a true infinite hang), but
 * only after the whole request sat there for 18 minutes, exactly this gap.
 *
 * Passed as `{ global: { fetch } }` to `createBrowserClient` /
 * `createServerClient` / the raw `@supabase/supabase-js` `createClient` —
 * all three forward `global.fetch` straight through to the underlying
 * `SupabaseClient`, which uses it for EVERY network call (auth, PostgREST,
 * storage), so wiring it in once at each client factory covers `getUser`,
 * `getSession`, `refreshSession`, and every `.from(...)` query made through
 * that client.
 *
 * Does not fight an abort signal the caller (or supabase-js internally)
 * already attached — combines both via manual listeners rather than
 * `AbortSignal.any` (Node 20.3+ only) to avoid a runtime-version dependency
 * neither this repo's package.json nor Vercel's default Node image pins
 * explicitly.
 */
export function fetchWithTimeout(timeoutMs: number): typeof fetch {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const timeoutController = new AbortController()
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs)

    const callerSignal = init?.signal
    if (callerSignal) {
      if (callerSignal.aborted) {
        timeoutController.abort()
      } else {
        callerSignal.addEventListener('abort', () => timeoutController.abort(), { once: true })
      }
    }

    return fetch(input, { ...init, signal: timeoutController.signal }).finally(() => {
      clearTimeout(timeoutId)
    })
  }
}

/**
 * Default bound for interactive auth/DB calls (getUser, getSession,
 * company_members lookups, etc.) — generous enough for a slow-but-healthy
 * connection, short enough that a stalled one fails in seconds, not
 * minutes, matching the other network timeouts already used in this repo
 * (PDF generation ~5-8s, WhatsApp ~10s — see lib/pdf, lib/whatsapp).
 */
export const DEFAULT_SUPABASE_TIMEOUT_MS = 10_000
