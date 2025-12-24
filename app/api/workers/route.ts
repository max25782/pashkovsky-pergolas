/**
 * API route for managing workers
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Worker } from '@/types/workers'
import { requireAuth } from '@/lib/auth'

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
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// GET - List all workers (active by default)
export async function GET(req: NextRequest) {
  // 🔒 Security: Require authentication
  const auth = await requireAuth(req)
  if (!auth.authorized) return auth.error

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'

    // 🔒 Security: Filter by company_id (unless admin token)
    let query = supabase
      .from('workers')
      .select('*')
      .order('first_name', { ascending: true })

    // Only filter by company if not using admin token
    if (auth.user.companyId && auth.user.companyId !== 'admin') {
      query = query.eq('company_id', auth.user.companyId) // Multi-tenant filter
    }

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching workers:', error)
      return NextResponse.json({ error: 'Failed to fetch workers' }, { status: 500 })
    }

    const workers = (data || []).map(transformWorkerFromDB)
    return NextResponse.json({ workers })
  } catch (error: any) {
    console.error('Error in GET /api/workers:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// POST - Create new worker
export async function POST(req: NextRequest) {
  // 🔒 Security: Require authentication
  const auth = await requireAuth(req)
  if (!auth.authorized) return auth.error

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const { firstName, lastName, phone, role, dailyRate, isActive = true } = body

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

    // 🔒 Security: Assign to user's company (or first available company for admin)
    let companyId = auth.user.companyId
    
    // If using admin token, get the first company from the database
    if (companyId === 'admin') {
      const { data: companies } = await supabase
        .from('companies')
        .select('id')
        .limit(1)
        .single()
      
      if (companies) {
        companyId = companies.id
      } else {
        return NextResponse.json(
          { error: 'No company found. Please create a company first.' },
          { status: 400 }
        )
      }
    }

    const { data, error } = await supabase
      .from('workers')
      .insert({
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

    if (error) {
      console.error('Error creating worker:', error)
      return NextResponse.json({ error: 'Failed to create worker' }, { status: 500 })
    }

    return NextResponse.json({ worker: transformWorkerFromDB(data) })
  } catch (error: any) {
    console.error('Error in POST /api/workers:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}


