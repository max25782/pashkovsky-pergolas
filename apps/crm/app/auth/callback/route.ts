import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

function sanitizeNext(input: string | null): string {
  if (!input) return '/app'
  if (!input.startsWith('/')) return '/app'
  if (input.startsWith('//')) return '/app'
  return input
}

function isLikelyPrefetch(request: NextRequest): boolean {
  const purpose = request.headers.get('purpose') || request.headers.get('sec-purpose') || request.headers.get('x-purpose')
  if (purpose && purpose.toLowerCase().includes('prefetch')) return true

  // Many email security scanners do not send Sec-Fetch-User at all.
  // Real user navigation typically includes: Sec-Fetch-User: ?1
  const secFetchUser = request.headers.get('sec-fetch-user')
  if (secFetchUser !== '?1') return true

  return false
}

/**
 * Supabase Auth Callback (server-only)
 *
 * Supports two flows:
 * 1) PKCE: /auth/callback?code=...
 *    - exchangeCodeForSession(code)
 *
 * 2) Admin-generated login link (no PKCE verifier available on recipient device):
 *    /auth/callback?token=...&type=magiclink
 *    - verifyOtp({ type: 'magiclink', token_hash: token })
 *
 * This avoids any client-side "hash fragment" hacks and always ends with cookies set server-side.
 *
 * Supabase Dashboard checklist:
 * - Auth → URL Configuration → Site URL: https://crm.pashkovsky-group.com
 * - Auth → URL Configuration → Redirect URLs includes: https://crm.pashkovsky-group.com/auth/callback
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)

  const code = url.searchParams.get('code')
  const token = url.searchParams.get('token')
  const type = url.searchParams.get('type')
  const next = sanitizeNext(url.searchParams.get('next'))

  console.log('[Callback] URL:', url.origin + url.pathname)
  console.log('[Callback] hasCode:', !!code, 'hasToken:', !!token, 'type:', type || 'none')

  const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSetArray) {
          cookiesToSetArray.forEach((cookie) => cookiesToSet.push(cookie))
        },
      },
    }
  )

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[Callback] exchangeCodeForSession error:', error.message)
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin))
    }

    const response = NextResponse.redirect(new URL(next, url.origin))
    cookiesToSet.forEach((cookie) => response.cookies.set({ name: cookie.name, value: cookie.value, ...cookie.options }))
    console.log('[Callback] cookiesSet:', cookiesToSet.length, '→', next)
    return response
  }

  // Admin-generated login flow (recommended for SuperAdmin “send access link”)
  if (token && type === 'magiclink') {
    // Prevent link scanners / prefetchers from consuming one-time OTPs.
    // Gmail/AV scanners often "click" links server-side; that would invalidate the token
    // before the real user opens it.
    if (isLikelyPrefetch(request)) {
      console.warn('[Callback] Skipping verifyOtp: likely prefetch/scanner (not consuming OTP)')
      return new NextResponse('OK', { status: 200 })
    }

    const { error } = await supabase.auth.verifyOtp({
      type: 'magiclink',
      token_hash: token,
    } as any)

    if (error) {
      console.error('[Callback] verifyOtp error:', error.message)
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin))
    }

    const response = NextResponse.redirect(new URL(next, url.origin))
    cookiesToSet.forEach((cookie) => response.cookies.set({ name: cookie.name, value: cookie.value, ...cookie.options }))
    console.log('[Callback] cookiesSet:', cookiesToSet.length, '→', next)
    return response
  }

  console.error('[Callback] Missing code (PKCE) and missing/invalid token flow')
  return NextResponse.redirect(new URL('/login?error=missing_code', url.origin))
}
