/** Browser wait for one AI Director reply. Longer than the function so the page does not abort first. */
export const AI_DIRECTOR_CLIENT_TIMEOUT_MS = 90_000

/**
 * Route limit. The CRM team is on Hobby. The published function default is
 * 300s on every plan, so 60s is inside the plan and matches this route.
 */
export const AI_DIRECTOR_MAX_DURATION_SEC = 60

export const DIRECTOR_TIMEOUT_MESSAGE = 'התשובה לא הספיקה להגיע. הסוכן עדיין אסף נתונים מה-CRM.'
export const DIRECTOR_RETRY_LABEL = 'נסו שוב'

export function isDirectorTimeout(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const name = 'name' in error && typeof error.name === 'string' ? error.name : ''
  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
  const text = `${name} ${message}`.toLowerCase()
  return name === 'AbortError' || name === 'TimeoutError' || text.includes('aborted') || text.includes('timed out')
}
