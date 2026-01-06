import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/app/admin'

  console.log('[Auth Callback] ===================')
  console.log('[Auth Callback] Full URL:', requestUrl.href)
  console.log('[Auth Callback] Code present:', !!code)
  console.log('[Auth Callback] Next destination:', next)
  console.log('[Auth Callback] ===================')

  if (!code) {
    console.error('[Auth Callback] ❌ No code in URL!')
    return NextResponse.redirect(new URL('/login?error=missing_code', requestUrl.origin))
  }

  const cookieStore: { name: string; value: string; options: CookieOptions }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.push({ name, value, options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.push({ name, value: '', options })
        },
      },
    }
  )

  console.log('[Auth Callback] Calling exchangeCodeForSession...')
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[Auth Callback] ❌ exchangeCodeForSession error:', error)
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
    )
  }

  console.log('[Auth Callback] ✓ exchangeCodeForSession succeeded')
  console.log('[Auth Callback] Cookies collected:', cookieStore.length)
  
  if (cookieStore.length > 0) {
    console.log('[Auth Callback] Cookie names:', cookieStore.map(c => c.name).join(', '))
  } else {
    console.warn('[Auth Callback] ⚠️ WARNING: No cookies collected!')
  }

  const response = NextResponse.redirect(new URL(next, requestUrl.origin))

  for (const c of cookieStore) {
    response.cookies.set({ name: c.name, value: c.value, ...c.options })
    console.log('[Auth Callback] → Set cookie:', c.name, '(length:', c.value.length, ')')
  }

  console.log('[Auth Callback] ✓ Redirecting to:', next)

  return response
}
