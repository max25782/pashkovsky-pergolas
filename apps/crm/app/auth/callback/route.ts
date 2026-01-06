import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/app'

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', requestUrl.origin))
  }

  // Create response first
  let response = NextResponse.redirect(new URL(next, requestUrl.origin))

  // Create Supabase server client with cookie handlers
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Set cookie on response
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          // Remove cookie from response
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Exchange code for session
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[Auth Callback] Error exchanging code:', error)
    return NextResponse.redirect(
      new URL('/login?error=' + encodeURIComponent(error.message), requestUrl.origin)
    )
  }

  console.log('[Auth Callback] Successfully authenticated, redirecting to:', next)

  return response
}
