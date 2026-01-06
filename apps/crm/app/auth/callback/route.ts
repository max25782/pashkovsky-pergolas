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

  const cookies: { name: string; value: string; options: CookieOptions }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => request.cookies.get(name)?.value,
        set: (name, value, options) => cookies.push({ name, value, options }),
        remove: (name, options) => cookies.push({ name, value: '', options }),
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[Callback] Exchange error:', error.message)
    return NextResponse.redirect(new URL('/login?error=auth', url.origin))
  }

  console.log('[Callback] Success! Cookies:', cookies.length, '→', next)

  const response = NextResponse.redirect(new URL(next, url.origin))

  cookies.forEach((c) => {
    response.cookies.set({
      name: c.name,
      value: c.value,
      ...c.options,
    })
  })

  return response
}
