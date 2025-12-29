import { createClient } from '@/lib/supabase/client'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/app/admin'

  if (code) {
    const supabase = createClient()
    
    // Exchange code for session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('[Auth Callback] Error exchanging code:', error)
      return NextResponse.redirect(new URL('/login?error=' + error.message, requestUrl.origin))
    }
    
    console.log('[Auth Callback] Successfully authenticated')
  }

  // Redirect to the next page
  return NextResponse.redirect(new URL(next, requestUrl.origin))
}

