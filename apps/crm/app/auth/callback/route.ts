import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  // Log raw request URL before parsing
  console.log('[Callback] Raw request URL:', request.url)
  console.log('[Callback] Request headers:', {
    referer: request.headers.get('referer'),
    'user-agent': request.headers.get('user-agent'),
  })
  
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const type = url.searchParams.get('type')
  const next = url.searchParams.get('next') || '/app'
  const urlError = url.searchParams.get('error')
  const errorDescription = url.searchParams.get('error_description')
  
  // Check hash fragment for implicit flow errors (shouldn't happen with PKCE)
  const hash = url.hash
  let hashError: string | null = null
  let hashErrorCode: string | null = null
  let hashErrorDescription: string | null = null
  
  if (hash) {
    console.warn('[Callback] ⚠️ Hash fragment detected - this indicates implicit flow, not PKCE!')
    const hashParams = new URLSearchParams(hash.substring(1)) // Remove '#'
    hashError = hashParams.get('error')
    hashErrorCode = hashParams.get('error_code')
    hashErrorDescription = hashParams.get('error_description')
  }

  console.log('[Callback] ===================')
  console.log('[Callback] Full URL:', url.href)
  console.log('[Callback] Hash:', hash || 'none')
  console.log('[Callback] Code:', code ? `✓ (${code.substring(0, 20)}...)` : '✗')
  console.log('[Callback] Type:', type || 'none')
  console.log('[Callback] Next:', next)
  console.log('[Callback] Query Error:', urlError || 'none')
  console.log('[Callback] Query Error Description:', errorDescription || 'none')
  if (hashError) {
    console.error('[Callback] Hash Error:', hashError)
    console.error('[Callback] Hash Error Code:', hashErrorCode)
    console.error('[Callback] Hash Error Description:', hashErrorDescription)
  }
  console.log('[Callback] All query params:', Object.fromEntries(url.searchParams.entries()))
  console.log('[Callback] ===================')

  // Check for Supabase error in URL (query params or hash fragment)
  const finalError = urlError || hashError
  const finalErrorDescription = errorDescription || hashErrorDescription || hashErrorCode
  
  if (finalError) {
    console.error('[Callback] Supabase error detected:', finalError)
    console.error('[Callback] Error source:', urlError ? 'query' : 'hash')
    console.error('[Callback] Error details:', finalErrorDescription)
    
    // If hash error, this means implicit flow was used (wrong!)
    if (hashError) {
      console.error('[Callback] ❌ CRITICAL: Hash fragment error indicates implicit flow!')
      console.error('[Callback] This means magic link was generated with wrong type (magiclink instead of recovery/invite)')
      console.error('[Callback] Or Supabase redirect URL is not configured correctly')
    }
    
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(finalError)}&error_code=${encodeURIComponent(hashErrorCode || '')}&description=${encodeURIComponent(finalErrorDescription || '')}`, url.origin)
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
