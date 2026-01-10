import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') || '/app'

  console.log('[Callback] URL:', url.pathname + url.search)
  console.log('[Callback] Has code:', !!code)
  console.log('[Callback] Next redirect:', next)

  if (!code) {
    console.error('[Callback] Missing code parameter')
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
