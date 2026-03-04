/**
 * Client-side cookie helper.
 * Safe to call from browser; returns empty string if cookie doesn't exist.
 */
export function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : ''
}
