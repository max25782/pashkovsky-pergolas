/**
 * API route for managing individual work shifts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requireCompanyAccess } from '@/lib/auth'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// DELETE - Delete a work shift
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 🔒 Security: Require authentication
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const shiftId = params.id

    if (!shiftId) {
      return NextResponse.json({ error: 'Shift ID is required' }, { status: 400 })
    }

    // 🔒 Security: Verify shift belongs to user's company
    const { data: shift, error: shiftError } = await supabase
      .from('work_shifts')
      .select('company_id')
      .eq('id', shiftId)
      .single()

    if (shiftError || !shift) {
      console.error('Error fetching shift:', shiftError)
      return NextResponse.json(
        { error: 'Shift not found or access denied' },
        { status: 404 }
      )
    }

    const access = await requireCompanyAccess(req, shift.company_id)
    if (!access.authorized) return access.error

    // Delete the shift
    const { error: deleteError } = await supabase
      .from('work_shifts')
      .delete()
      .eq('id', shiftId)

    if (deleteError) {
      console.error('Error deleting shift:', deleteError)
      return NextResponse.json({ error: 'Failed to delete shift' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/work-shifts/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
