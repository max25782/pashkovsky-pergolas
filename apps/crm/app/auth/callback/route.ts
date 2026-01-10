import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

/**
 * Supabase Auth Callback - PKCE Flow Only
 * 
 * Handles PKCE authentication callback from Supabase.
 * 
 * Expected flow:
 * 1. User clicks magic link → Supabase redirects to /auth/callback?code=...
 * 2. This route exchanges code for session via exchangeCodeForSession(code)
 * 3. Session cookies are set on the response
 * 4. User is redirected to /app
 * 
 * Requirements:
 * - Supabase Dashboard → Auth → URL Configuration:
 *   - Site URL: https://crm.pashkovsky-group.com
 *   - Redirect URLs: https://crm.pashkovsky-group.com/auth/callback
 * - PKCE must be enabled in Supabase Dashboard
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') || '/app'

  // Validate next parameter (prevent open redirect)
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/app'

  if (!code) {
    console.error('[Callback] Missing code parameter - PKCE flow requires code')
    return NextResponse.redirect(new URL(`/login?error=missing_code`, url.origin))
  }

  // Accumulate cookies during exchangeCodeForSession
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

  // Exchange code for session (PKCE flow)
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[Callback] exchangeCodeForSession error:', error.message)
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin))
  }

  // Create redirect response and set all cookies
  const response = NextResponse.redirect(new URL(safeNext, url.origin))
  
  cookiesToSet.forEach((cookie) => {
    response.cookies.set({
      name: cookie.name,
      value: cookie.value,
      ...cookie.options,
    })
  })

  console.log('[Callback] Session established, redirecting to:', safeNext)
  return response
}
