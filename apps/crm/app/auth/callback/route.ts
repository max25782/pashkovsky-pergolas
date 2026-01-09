import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') || '/app'
  const error = url.searchParams.get('error')
  const errorDescription = url.searchParams.get('error_description')

  console.log('[Callback] ===================')
  console.log('[Callback] Full URL:', url.href)
  console.log('[Callback] Code:', code ? `✓ (${code.substring(0, 20)}...)` : '✗')
  console.log('[Callback] Next:', next)
  console.log('[Callback] Error:', error || 'none')
  console.log('[Callback] Error Description:', errorDescription || 'none')
  console.log('[Callback] All params:', Object.fromEntries(url.searchParams.entries()))
  console.log('[Callback] ===================')

  // Check for Supabase error in URL
  if (error) {
    console.error('[Callback] Supabase error in URL:', error, errorDescription)
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || '')}`, url.origin)
    )
  }

  if (!code) {
    console.error('[Callback] Missing code parameter')
    console.error('[Callback] Available params:', Array.from(url.searchParams.keys()))
    return NextResponse.redirect(new URL('/login?error=missing_code', url.origin))
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
        setAll(cookiesToSetArray) {
          cookiesToSetArray.forEach((cookie) => {
            cookiesToSet.push(cookie)
          })
        },
      },
    }
  )

  console.log('[Callback] Exchanging code for session...')
  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[Callback] ✗ Exchange error:', error.message)
    console.error('[Callback] Error code:', error.status)
    console.error('[Callback] Error details:', error)
    return NextResponse.redirect(
      new URL(`/login?error=exchange_failed&message=${encodeURIComponent(error.message)}`, url.origin)
    )
  }

  console.log('[Callback] ✓ Exchange successful')
  console.log('[Callback] Session user:', sessionData.user?.email || 'no user')
  console.log('[Callback] Cookies to set:', cookiesToSet.length)
  
  if (cookiesToSet.length === 0) {
    console.warn('[Callback] ⚠️ WARNING: No cookies collected!')
  } else {
    console.log('[Callback] Cookie names:', cookiesToSet.map(c => c.name).join(', '))
  }

  console.log('[Callback] Redirecting to:', next)

  const response = NextResponse.redirect(new URL(next, url.origin))

  cookiesToSet.forEach((cookie) => {
    response.cookies.set({
      name: cookie.name,
      value: cookie.value,
      ...cookie.options,
    })
  })

  return response
}
