import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAuthUrl, isGoogleOAuthConfigured } from '@/lib/auth/oauth/google'

/**
 * GET /api/auth/oauth/google
 * Initiate Google OAuth flow
 */
export async function GET(req: NextRequest) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      { error: 'Google OAuth not configured' },
      { status: 500 }
    )
  }

  try {
    const { searchParams } = new URL(req.url)
    const state = searchParams.get('state') || 'default'
    const redirect = searchParams.get('redirect') || '/admin'

    // Store redirect URL in state (encode it)
    const stateWithRedirect = JSON.stringify({ state, redirect })
    
    const authUrl = getGoogleAuthUrl(stateWithRedirect)
    
    // Redirect to Google OAuth
    return NextResponse.redirect(authUrl)
  } catch (error: any) {
    console.error('[Google OAuth] Error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    )
  }
}



