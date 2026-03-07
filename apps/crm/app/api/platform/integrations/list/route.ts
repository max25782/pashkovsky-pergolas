/**
 * SuperAdmin API - List Integrations
 * GET /api/platform/integrations/list
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireSuperAdmin } from '@/lib/middleware/superadmin-auth'

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
 * GET - List all integrations
 */
export async function GET(request: NextRequest) {
  try {
    // Verify SuperAdmin
    await requireSuperAdmin(request)

    // Fetch all integrations with company names
    const { data: integrations, error } = await supabase
      .from('company_integrations')
      .select(`
        *,
        companies (
          name
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ integrations: integrations || [] })
  } catch (error: unknown) {
    console.error('[Platform API] List integrations error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    if (msg?.includes('Unauthorized') || msg?.includes('Forbidden')) {
      return NextResponse.json(
        { error: msg },
        { status: msg.includes('Unauthorized') ? 401 : 403 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

