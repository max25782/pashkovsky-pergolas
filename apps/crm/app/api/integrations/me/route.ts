/**
 * Integration Management API - Get Integration Status
 * GET /api/integrations/me
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

/**
 * GET - Fetch current company's integration status
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await requireAuthAsync(request)
    if (!authResult.authorized) {
      return authResult.error
    }

    const companyId = authResult.context.companyId
    if (!companyId) {
      return NextResponse.json(
        { error: 'No company found for user' },
        { status: 404 }
      )
    }

    // Fetch integration
    const { data: integration, error } = await supabase
      .from('company_integrations')
      .select('*')
      .eq('company_id', companyId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found - return null
        return NextResponse.json({ integration: null })
      }
      throw error
    }

    // Redact webhook_secret if not active
    if (integration.status !== 'active') {
      integration.webhook_secret = '***REDACTED***'
    }

    return NextResponse.json({ integration })
  } catch (error: unknown) {
    console.error('[Integration API] GET error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    if (msg?.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

