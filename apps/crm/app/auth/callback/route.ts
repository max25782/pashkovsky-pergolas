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
    
    // If no code parameter, return HTML page with client-side processing
    // This handles cases where Supabase redirects with hash fragments (#access_token)
    // which are not visible to the server
    console.log('[Callback] Returning client-side processing page for hash fragments')
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Processing authentication...</title>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script>
    (async function() {
      const supabaseUrl = '${process.env.NEXT_PUBLIC_SUPABASE_URL}';
      const supabaseAnonKey = '${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}';
      const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
      
      console.log('[Auth Callback Client] Starting callback processing...');
      console.log('[Auth Callback Client] Current URL:', window.location.href);
      console.log('[Auth Callback Client] Hash:', window.location.hash);
      
      // Check for hash fragment (implicit flow or recovery)
      const hash = window.location.hash.substring(1);
      
      if (hash) {
        console.log('[Auth Callback Client] Hash fragment detected');
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');
        
        if (error) {
          console.error('[Auth Callback Client] Hash error:', error, errorDescription);
          window.location.href = '/login?error=' + encodeURIComponent(error) + 
            (errorDescription ? '&description=' + encodeURIComponent(errorDescription) : '');
          return;
        }
        
        if (accessToken && refreshToken) {
          console.log('[Auth Callback Client] Setting session from hash...');
          
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (sessionError) {
            console.error('[Auth Callback Client] Set session error:', sessionError);
            window.location.href = '/login?error=' + encodeURIComponent(sessionError.message);
            return;
          }
          
          console.log('[Auth Callback Client] ✓ Session set successfully');
          window.location.href = '/app';
          return;
        }
      }
      
      // Check for code parameter in URL (shouldn't happen here but just in case)
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code) {
        console.log('[Auth Callback Client] Code parameter found, exchanging...');
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) {
          console.error('[Auth Callback Client] Exchange error:', error);
          window.location.href = '/login?error=' + encodeURIComponent(error.message);
          return;
        }
        
        console.log('[Auth Callback Client] ✓ Exchange successful');
        window.location.href = '/app';
        return;
      }
      
      // No parameters found
      console.error('[Auth Callback Client] No authentication parameters found');
      window.location.href = '/login?error=missing_code';
    })();
  </script>
</head>
<body>
  <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui;">
    <div style="text-align: center;">
      <div style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 48px; height: 48px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
      <p style="margin-top: 16px; color: #666;">Processing authentication...</p>
    </div>
  </div>
  <style>
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</body>
</html>
    `.trim();
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
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
