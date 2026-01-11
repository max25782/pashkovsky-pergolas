import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') || '/app'
  const hash = url.hash

  console.log('[Callback] URL:', url.pathname + url.search + (hash ? '#' + hash.substring(0, 50) + '...' : ''))
  console.log('[Callback] Has code:', !!code)
  console.log('[Callback] Has hash:', !!hash)
  console.log('[Callback] Next redirect:', next)
  console.log('[Callback] All search params:', Object.fromEntries(url.searchParams))

  // Check for PKCE code in query (preferred)
  if (code) {
    console.log('[Callback] Found code parameter, using PKCE flow')
  } else if (hash) {
    // Fallback: check for hash fragment (implicit flow - not ideal but handle it)
    console.warn('[Callback] No code parameter, checking hash fragment (implicit flow)')
    const hashParams = new URLSearchParams(hash.substring(1))
    const accessToken = hashParams.get('access_token')
    const error = hashParams.get('error')
    
    if (error) {
      console.error('[Callback] Error in hash:', error)
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error)}`, url.origin)
      )
    }
    
    if (accessToken) {
      console.warn('[Callback] Found access_token in hash - this is implicit flow, not PKCE')
      // For implicit flow, we need to set the session differently
      // But ideally, we should fix the link generation to use PKCE
      return NextResponse.redirect(
        new URL('/login?error=implicit_flow_not_supported', url.origin)
      )
    }
  }

  if (!code) {
    console.error('[Callback] Missing code parameter and no valid hash found')
    console.error('[Callback] Full URL:', url.toString())
    return NextResponse.redirect(
      new URL('/login?error=missing_code', url.origin)
    )
  }

  const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookies) {
          cookiesToSet.push(...cookies)
        },
      },
    }
  )

  console.log('[Callback] Exchanging code for session...')
  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[Callback] exchangeCodeForSession error:', error.message)
    return NextResponse.redirect(
      new URL(`/login?error=auth_failed`, url.origin)
    )
  }

  console.log('[Callback] Session established, user:', sessionData.user?.email)
  console.log('[Callback] Cookies to set:', cookiesToSet.length)

  // Note: Trial activation happens in /app/page.tsx after redirect
  // This keeps callback minimal and fast

  // Log cookie details
  cookiesToSet.forEach((c, i) => {
    console.log(`[Callback] Cookie ${i + 1}:`, {
      name: c.name,
      value: c.value.substring(0, 20) + '...',
      domain: c.options?.domain,
      path: c.options?.path,
      httpOnly: c.options?.httpOnly,
      secure: c.options?.secure,
      sameSite: c.options?.sameSite,
    })
  })

  const response = NextResponse.redirect(new URL(next, url.origin))

  for (const c of cookiesToSet) {
    response.cookies.set({
      name: c.name,
      value: c.value,
      ...c.options,
      // Ensure cookies are set with proper options for production
      httpOnly: c.options?.httpOnly ?? true,
      secure: c.options?.secure ?? process.env.NODE_ENV === 'production',
      sameSite: c.options?.sameSite ?? 'lax',
      path: c.options?.path ?? '/',
    })
  }

  console.log('[Callback] Redirecting to', next, 'with', cookiesToSet.length, 'cookies set')
  return response
}
