/**
 * Browser wait for one AI Director reply (SSE).
 * 120s reduces AbortError on CRM tool chains; Hobby maxDuration remains 300s.
 * If the browser still times out, the page shows a Hebrew retry (not AbortError text).
 */
export const AI_DIRECTOR_CLIENT_TIMEOUT_MS = 120_000

/**
 * Vercel Fluid Compute (Hobby): default and maximum function duration is 300s.
 * Pro/Enterprise can raise to 800s (or 1800s beta). This project uses the Hobby ceiling.
 */
export const AI_DIRECTOR_MAX_DURATION_SEC = 300

export const DIRECTOR_TIMEOUT_MESSAGE = 'התשובה לא הספיקה להגיע. הסוכן עדיין אסף נתונים מה-CRM.'
export const DIRECTOR_RETRY_LABEL = 'נסו שוב'

export function isDirectorTimeout(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const name = 'name' in error && typeof error.name === 'string' ? error.name : ''
  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
  const text = `${name} ${message}`.toLowerCase()
  return name === 'AbortError' || name === 'TimeoutError' || text.includes('aborted') || text.includes('timed out')
}
