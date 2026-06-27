/**
 * API route for material orders (חומר הוזמן)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { MaterialOrder, MaterialOrderCreate } from '@/types/material-order'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requireCompanyAccess } from '@/lib/auth'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// GET - List material orders
export async function GET(req: NextRequest) {
  // 🔒 Security: Require authentication
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const dealId = searchParams.get('dealId')

    if (!dealId) {
      return NextResponse.json({ error: 'dealId is required' }, { status: 400 })
    }

    // 🔒 Security: Verify deal belongs to user's company
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('company_id')
      .eq('id', dealId)
      .single()

    if (dealError || !deal) {
      console.error('Error fetching deal:', dealError)
      return NextResponse.json(
        { error: 'Deal not found or access denied' },
        { status: 404 }
      )
    }

    const access = await requireCompanyAccess(req, deal.company_id)
    if (!access.authorized) return access.error

    // Now safe to fetch material orders
    const { data, error } = await supabase
      .from('material_orders')
      .select('*')
      .eq('deal_id', dealId)
      .order('order_date', { ascending: false })

    if (error) {
      console.error('Error fetching material orders:', error)
      return NextResponse.json({ error: 'Failed to fetch material orders' }, { status: 500 })
    }

    return NextResponse.json({ orders: data || [] })
  } catch (error: unknown) {
    console.error('Error in GET /api/material-orders:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create material order
export async function POST(req: NextRequest) {
  // 🔒 Security: Require authentication
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const body: MaterialOrderCreate = await req.json()

    if (!body.deal_id || !body.material_type) {
      return NextResponse.json(
        { error: 'deal_id and material_type are required' },
        { status: 400 }
      )
    }

    // 🔒 Security: Verify deal belongs to user's company
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('company_id')
      .eq('id', body.deal_id)
      .single()

    if (dealError || !deal) {
      console.error('Error fetching deal:', dealError)
      return NextResponse.json(
        { error: 'Deal not found or access denied' },
        { status: 404 }
      )
    }

    const access = await requireCompanyAccess(req, deal.company_id)
    if (!access.authorized) return access.error

    // Now safe to create material order
    const { data, error } = await supabase
      .from('material_orders')
      .insert({
        ...body,
        status: body.status || 'ordered',
        order_date: body.order_date || new Date().toISOString(),
        currency: body.currency || 'ILS',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating material order:', error)
      return NextResponse.json(
        { error: 'Failed to create material order', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ order: data })
  } catch (error: unknown) {
    console.error('Error in POST /api/material-orders:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}




