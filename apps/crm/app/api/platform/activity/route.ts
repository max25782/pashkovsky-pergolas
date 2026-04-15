/**
 * Platform Activity API
 * GET: Retrieve recent platform activity logs
 * Only accessible by SuperAdmin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkSuperAdminAuth } from '@/lib/middleware/superadmin-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await checkSuperAdminAuth(request)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

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

    const { data, error } = await supabase
      .from('platform_audit_logs')
      .select(`
        id,
        event_type,
        payload,
        created_at,
        company_id,
        companies(name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[Platform Activity GET] Error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('[Platform Activity GET] Exception:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

