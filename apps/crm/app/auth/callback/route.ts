import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') || '/app'
  const hash = url.hash


  // Check for PKCE code in query (preferred)
  if (code) {
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

  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[Callback] exchangeCodeForSession error:', error.message)
    return NextResponse.redirect(
      new URL(`/login?error=auth_failed`, url.origin)
    )
  }

  // When the OAuth flow is initiated from the register page (?setup=true),
  // create the company for the new user and capture acquisition source.
  const isSetup = url.searchParams.get('setup') === 'true'
  if (isSetup && sessionData?.user) {
    const oauthUser = sessionData.user

    // Read UTMs that the register page stored in a short-lived cookie before redirecting to Google
    const regUtmRaw = request.cookies.get('reg_utm')?.value
    const utmParams: Record<string, string> = {}
    if (regUtmRaw) {
      try {
        new URLSearchParams(decodeURIComponent(regUtmRaw)).forEach((v, k) => {
          utmParams[k] = v
        })
      } catch {
        // Ignore malformed cookie
      }
    }

    const fullName    = oauthUser.user_metadata?.full_name as string | undefined
    const companyName = fullName
      ?? (oauthUser.email?.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') || 'My Company')

    try {
      const setupRes = await fetch(new URL('/api/auth/setup-company', url.origin).toString(), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:             oauthUser.id,
          email:               oauthUser.email,
          full_name:           fullName,
          company_name:        companyName,
          registration_source: 'google_oauth',
          utm_source:          utmParams['utm_source']   ?? null,
          utm_medium:          utmParams['utm_medium']   ?? null,
          utm_campaign:        utmParams['utm_campaign'] ?? null,
          referrer_url:        utmParams['referrer_url'] ?? null,
        }),
      })
      if (!setupRes.ok) {
        const body = await setupRes.json().catch(() => ({}))
        console.error('[Callback] setup-company failed:', body)
      }
    } catch (setupErr) {
      console.error('[Callback] setup-company request error:', setupErr)
    }
  }

  // Log cookie details
  cookiesToSet.forEach((_c, _i) => {
    // cookie details logged during auth flow
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

  return response
}
