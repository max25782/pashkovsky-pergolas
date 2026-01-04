/**
 * SuperAdmin API: Onboard New Company
 * Manually create company + user + enterprise subscription
 * Protected by SuperAdmin authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/middleware/superadmin-auth'
import { onboardCompany } from '@/lib/services/company-onboarding-service'

interface OnboardRequest {
  email: string
  sendInviteEmail?: boolean
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * POST - Onboard new company
 */
export async function POST(request: NextRequest) {
  try {
    // 🔒 Require SuperAdmin authentication
    const adminSession = await requireSuperAdmin(request)

    // Parse request body
    let body: OnboardRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { email, sendInviteEmail = false } = body

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required and must be a string' },
        { status: 400 }
      )
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    console.log('[API /superadmin/companies/onboard] Starting onboarding for:', email)

    // Execute onboarding
    const result = await onboardCompany(
      email.toLowerCase().trim(),
      sendInviteEmail,
      adminSession.user_id
    )

    if (!result.success) {
      console.error('[API /superadmin/companies/onboard] Onboarding failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'Onboarding failed' },
        { status: 500 }
      )
    }

    console.log('[API /superadmin/companies/onboard] Onboarding successful:', {
      company_id: result.company_id,
      user_id: result.user_id,
    })

    return NextResponse.json({
      success: true,
      company_id: result.company_id,
      user_id: result.user_id,
      company_name: result.company_name,
      magic_link_sent: result.magic_link_sent,
      magic_link_url: result.magic_link_url,
    })
  } catch (error: any) {
    console.error('[API /superadmin/companies/onboard] Unexpected error:', error)

    // Check if it's an auth error
    if (error.message?.includes('Unauthorized') || error.message?.includes('Authentication required')) {
      return NextResponse.json(
        { error: 'Unauthorized: SuperAdmin access required' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

