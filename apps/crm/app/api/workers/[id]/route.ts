/**
 * API route for managing individual worker
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Worker } from '@/types/workers'
import { requireAuth, verifyResourceOwnership } from '@/lib/auth'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// Transform DB row to Worker
function transformWorkerFromDB(row: any): Worker {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    role: row.role,
    dailyRate: parseFloat(row.daily_rate),
    hourlyRate: row.hourly_rate != null ? parseFloat(row.hourly_rate) : null,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// PATCH - Update worker
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params

  // 🔒 Security: Require authentication
  const auth = await requireAuth(req)
  if (!auth.authorized) return auth.error

  // 🔒 Security: Verify worker belongs to user's company
  const ownership = await verifyResourceOwnership(req, 'workers', params.id)
  if (!ownership.authorized) return ownership.error

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const updates: any = {}

    if (body.firstName !== undefined) updates.first_name = body.firstName
    if (body.lastName !== undefined) updates.last_name = body.lastName
    if (body.phone !== undefined) updates.phone = body.phone || null
    if (body.role !== undefined) updates.role = body.role || null
    if (body.dailyRate !== undefined) {
      if (body.dailyRate <= 0) {
        return NextResponse.json(
          { error: 'dailyRate must be greater than 0' },
          { status: 400 }
        )
      }
      updates.daily_rate = body.dailyRate
    }
    if (body.isActive !== undefined) updates.is_active = body.isActive

    const { data, error } = await supabase
      .from('workers')
      .update(updates)
      .eq('id', params.id)
      // Extra safety: only filter by company if not admin token
      .match(auth.user.companyId === 'admin' ? {} : { company_id: auth.user.companyId })
      .select()
      .single()

    if (error) {
      console.error('Error updating worker:', error)
      return NextResponse.json({ error: 'Failed to update worker' }, { status: 500 })
    }

    return NextResponse.json({ worker: transformWorkerFromDB(data) })
  } catch (error: unknown) {
    console.error('Error in PATCH /api/workers/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// DELETE - Delete worker
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params

  // 🔒 Security: Require authentication
  const auth = await requireAuth(req)
  if (!auth.authorized) return auth.error

  // 🔒 Security: Verify worker belongs to user's company
  const ownership = await verifyResourceOwnership(req, 'workers', params.id)
  if (!ownership.authorized) return ownership.error

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const { error } = await supabase
      .from('workers')
      .delete()
      .eq('id', params.id)
      .eq('company_id', auth.user.companyId) // Extra safety

    if (error) {
      console.error('Error deleting worker:', error)
      return NextResponse.json({ error: 'Failed to delete worker' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error in DELETE /api/workers/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

