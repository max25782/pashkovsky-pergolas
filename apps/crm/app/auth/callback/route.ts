import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') || '/app'

  console.log('[Callback] URL:', url.href)
  console.log('[Callback] Code:', code ? '✓' : '✗')

  if (!code) {
    console.error('[Callback] Missing code')
    return NextResponse.redirect(new URL('/login?error=auth', url.origin))
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

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[Callback] Exchange error:', error.message)
    return NextResponse.redirect(new URL('/login?error=auth', url.origin))
  }

  console.log('[Callback] Success! Cookies:', cookiesToSet.length, '→', next)

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
