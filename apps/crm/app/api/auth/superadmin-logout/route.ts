/**
 * SuperAdmin Logout API
 * Deletes server-side session and clears cookie
 */

import { NextRequest, NextResponse } from 'next/server'
import { deleteSession } from '@/lib/session/redis-client'

export async function POST(request: NextRequest) {
  try {
    // Get session ID from cookie
    const sessionId = request.cookies.get('superadmin_session')?.value

    if (sessionId) {
      // Delete session from Redis
      await deleteSession(sessionId)
    }

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })

    // Clear cookie
    response.cookies.delete('superadmin_session')

    return response
  } catch (error) {
    console.error('[SuperAdmin Logout] Error:', error)
    
    // Still clear cookie even if Redis fails
    const response = NextResponse.json({
      success: true,
      message: 'Logged out',
    })
    
    response.cookies.delete('superadmin_session')
    
    return response
  }
}

