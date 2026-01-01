/**
 * SuperAdmin API: Delete Company
 * Only accessible with valid SuperAdmin session
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session/redis-client'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check SuperAdmin session
    const sessionId = request.cookies.get('superadmin_session')?.value

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const session = await getSession(sessionId)

    if (!session || session.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Unauthorized - SuperAdmin access required' },
        { status: 401 }
      )
    }

    const companyId = params.id

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      )
    }

    // Use SERVICE_ROLE_KEY for admin operations
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

    console.log('[SuperAdmin] Deleting company:', companyId)

    // Delete company (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('companies')
      .delete()
      .eq('id', companyId)

    if (deleteError) {
      console.error('[SuperAdmin] Delete error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete company', details: deleteError.message },
        { status: 500 }
      )
    }

    console.log('[SuperAdmin] Company deleted successfully:', companyId)

    return NextResponse.json({
      success: true,
      message: 'Company deleted successfully',
    })
  } catch (error) {
    console.error('[SuperAdmin] Delete company error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

