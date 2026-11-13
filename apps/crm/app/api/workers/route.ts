/**
 * API route for managing workers
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { workerFromDB, isSchemaMissingError, TERMS_MIGRATION_MESSAGE } from '@/lib/workers/worker-db'
import {
  DEFAULT_EMPLOYER_COEFFICIENT,
  DEFAULT_PENSION_RATE,
} from '@/lib/workers/employer-cost'
import { validateTermsInput } from '@/lib/workers/terms-history'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { getUserContextAsync } from '@/lib/middleware/company-context'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// GET - List all workers (active by default)
export async function GET(req: NextRequest) {
  // 🔒 Security: Require authentication
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'

    // Get user context to extract company_id
    const userContext = await getUserContextAsync(req)
    const companyId = userContext?.companyId

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
    }

    // 🔒 Security: Filter by company_id
    let query = supabase
      .from('workers')
      .select('*')
      .eq('company_id', companyId) // Multi-tenant filter
      .order('first_name', { ascending: true })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching workers:', error)
      return NextResponse.json({ error: 'Failed to fetch workers' }, { status: 500 })
    }

    const workers = (data || []).map(workerFromDB)
    return NextResponse.json({ workers })
  } catch (error: unknown) {
    console.error('Error in GET /api/workers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new worker
export async function POST(req: NextRequest) {
  // 🔒 Security: Require authentication
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const { firstName, lastName, phone, role, dailyRate, isActive = true } = body
    const { employerCoefficient, pensionRate, pensionExempt } = body

    if (!firstName || !lastName || !dailyRate) {
      return NextResponse.json(
        { error: 'firstName, lastName, and dailyRate are required' },
        { status: 400 }
      )
    }

    if (dailyRate <= 0) {
      return NextResponse.json(
        { error: 'dailyRate must be greater than 0' },
        { status: 400 }
      )
    }

    const termsErrors = validateTermsInput({ employerCoefficient, pensionRate })
    if (Object.keys(termsErrors).length > 0) {
      return NextResponse.json({ error: Object.values(termsErrors)[0] }, { status: 400 })
    }

    // Get user context to extract company_id
    const userContext = await getUserContextAsync(req)
    const companyId = userContext?.companyId

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
    }

    // Only non-default terms are sent, so creating a worker keeps working
    // before migration 062 is applied (the columns default to 25 / 12.5 / false).
    const termsColumns: Record<string, number | boolean> = {}
    if (employerCoefficient !== undefined && employerCoefficient !== DEFAULT_EMPLOYER_COEFFICIENT) {
      termsColumns.employer_coefficient = employerCoefficient
    }
    if (pensionRate !== undefined && pensionRate !== DEFAULT_PENSION_RATE) {
      termsColumns.pension_rate = pensionRate
    }
    if (pensionExempt === true) termsColumns.pension_exempt = true

    const { data, error } = await supabase
      .from('workers')
      .insert({
        ...termsColumns,
        company_id: companyId, // Multi-tenant assignment
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        role: role || null,
        daily_rate: dailyRate,
        is_active: isActive !== undefined ? isActive : true,
      })
      .select()
      .single()

    if (error && isSchemaMissingError(error)) {
      return NextResponse.json({ error: TERMS_MIGRATION_MESSAGE }, { status: 409 })
    }

    if (error) {
      console.error('Error creating worker:', error)
      return NextResponse.json({ error: 'Failed to create worker', details: error.message }, { status: 500 })
    }

    return NextResponse.json({ worker: workerFromDB(data) })
  } catch (error: unknown) {
    console.error('Error in POST /api/workers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


