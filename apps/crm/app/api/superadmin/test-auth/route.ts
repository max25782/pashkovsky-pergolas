import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/middleware/superadmin-auth'

export const dynamic = 'force-dynamic'

/**
 * Test SuperAdmin authentication
 * Use this to verify auth is working before trying complex operations
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Test Auth] Checking SuperAdmin auth...')
    
    const session = await requireSuperAdmin(request)
    
    console.log('[Test Auth] ✓ Auth successful:', session.email)
    
    return NextResponse.json({
      success: true,
      message: 'SuperAdmin authentication successful',
      session: {
        user_id: session.user_id,
        email: session.email,
        role: session.role,
        auth_method: session.auth_method,
      },
    })
  } catch (error: any) {
    console.error('[Test Auth] ✗ Auth failed:', error.message)
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Authentication failed',
      cookies: {
        has_superadmin_session: !!request.cookies.get('superadmin_session'),
        has_sb_auth_token: !!request.cookies.getAll().find(c => c.name.startsWith('sb-')),
      },
    }, { status: 401 })
  }
}

