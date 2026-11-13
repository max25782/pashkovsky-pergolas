/**
 * API route for managing individual worker
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { workerFromDB, isSchemaMissingError, TERMS_MIGRATION_MESSAGE } from '@/lib/workers/worker-db'
import {
  currentTermsValues,
  planTermsHistory,
  sameTerms,
  validateTermsInput,
  type EmployerTermsValues,
} from '@/lib/workers/terms-history'
import { todayInIsrael } from '@/lib/tazrim/format'
import { requireAuth, verifyResourceOwnership } from '@/lib/auth'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

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

    // Employer terms: validate, and note whether they actually change so the
    // history (used for per-day costing) is only written on a real change.
    const termsErrors = validateTermsInput({
      employerCoefficient: body.employerCoefficient,
      pensionRate: body.pensionRate,
    })
    if (Object.keys(termsErrors).length > 0) {
      return NextResponse.json({ error: Object.values(termsErrors)[0] }, { status: 400 })
    }

    const touchesTerms =
      body.employerCoefficient !== undefined ||
      body.pensionRate !== undefined ||
      body.pensionExempt !== undefined

    let termsBefore: EmployerTermsValues | null = null
    let termsAfter: EmployerTermsValues | null = null
    if (touchesTerms) {
      let existing = supabase.from('workers').select('*').eq('id', params.id)
      if (auth.user.companyId !== 'admin') existing = existing.eq('company_id', auth.user.companyId)
      const { data: existingRow, error: existingError } = await existing.single()
      if (existingError || !existingRow) {
        console.error('Error loading worker before update:', existingError)
        return NextResponse.json({ error: 'Failed to update worker' }, { status: 500 })
      }
      termsBefore = currentTermsValues(existingRow)
      termsAfter = {
        employerCoefficient: body.employerCoefficient ?? termsBefore.employerCoefficient,
        pensionRate: body.pensionRate ?? termsBefore.pensionRate,
        pensionExempt: body.pensionExempt ?? termsBefore.pensionExempt,
      }
      if (!sameTerms(termsBefore, termsAfter)) {
        updates.employer_coefficient = termsAfter.employerCoefficient
        updates.pension_rate = termsAfter.pensionRate
        updates.pension_exempt = termsAfter.pensionExempt
      }
    }

    const { data, error } = await supabase
      .from('workers')
      .update(updates)
      .eq('id', params.id)
      // Extra safety: only filter by company if not admin token
      .match(auth.user.companyId === 'admin' ? {} : { company_id: auth.user.companyId })
      .select()
      .single()

    if (error && isSchemaMissingError(error)) {
      return NextResponse.json({ error: TERMS_MIGRATION_MESSAGE }, { status: 409 })
    }

    if (error) {
      console.error('Error updating worker:', error)
      return NextResponse.json({ error: 'Failed to update worker' }, { status: 500 })
    }

    if (termsBefore && termsAfter) {
      const { count, error: historyCountError } = await supabase
        .from('worker_rate_history')
        .select('id', { count: 'exact', head: true })
        .eq('worker_id', params.id)
      if (historyCountError) {
        console.error('Error reading worker_rate_history:', historyCountError)
        return NextResponse.json({ error: 'Saved, but failed to record the terms history' }, { status: 500 })
      }

      const historyRows = planTermsHistory({
        before: termsBefore,
        after: termsAfter,
        hasHistory: (count ?? 0) > 0,
        today: todayInIsrael(),
      })
      if (historyRows.length > 0) {
        const { error: historyError } = await supabase
          .from('worker_rate_history')
          .upsert(
            historyRows.map((row) => ({
              ...row,
              company_id: data.company_id,
              worker_id: params.id,
              created_by: auth.user.userId ?? null,
            })),
            { onConflict: 'worker_id,effective_from' },
          )
        if (historyError) {
          console.error('Error writing worker_rate_history:', historyError)
          return NextResponse.json({ error: 'Saved, but failed to record the terms history' }, { status: 500 })
        }
      }
    }

    return NextResponse.json({ worker: workerFromDB(data) })
  } catch (error: unknown) {
    console.error('Error in PATCH /api/workers/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
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
    // Dependent rows reference workers (FK often ON DELETE RESTRICT until migrations apply).
    const childTables = ['worker_shifts', 'work_shifts'] as const
    for (const table of childTables) {
      let del = supabase.from(table).delete().eq('worker_id', params.id)
      if (auth.user.companyId !== 'admin') {
        del = del.eq('company_id', auth.user.companyId)
      }
      const { error: childError } = await del
      if (childError) {
        console.error(`Error deleting worker rows from ${table}:`, childError)
        return NextResponse.json(
          { error: `Failed to delete related ${table.replace('_', ' ')}` },
          { status: 500 }
        )
      }
    }

    let workerDelete = supabase.from('workers').delete().eq('id', params.id)
    if (auth.user.companyId !== 'admin') {
      workerDelete = workerDelete.eq('company_id', auth.user.companyId)
    }
    const { error } = await workerDelete

    if (error) {
      console.error('Error deleting worker:', error)
      return NextResponse.json({ error: 'Failed to delete worker' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error in DELETE /api/workers/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

