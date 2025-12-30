/**
 * SuperAdmin Session Check API
 * Validates session from httpOnly cookie
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session/redis-client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get session ID from cookie
    const sessionId = request.cookies.get('superadmin_session')?.value

    if (!sessionId) {
      return NextResponse.json(
        { authenticated: false, error: 'No session cookie' },
        { status: 401 }
      )
    }

    // Validate session in Redis
    const session = await getSession(sessionId)

    if (!session) {
      // Session expired or invalid
      const response = NextResponse.json(
        { authenticated: false, error: 'Session expired' },
        { status: 401 }
      )
      
      // Clear invalid cookie
      response.cookies.delete('superadmin_session')
      
      return response
    }

    // Session is valid
    return NextResponse.json({
      authenticated: true,
      user: {
        email: session.email,
        role: session.role,
        // Don't expose user_id or phone to client for security
      },
    })
  } catch (error) {
    console.error('[SuperAdmin Session Check] Error:', error)
    return NextResponse.json(
      { authenticated: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

