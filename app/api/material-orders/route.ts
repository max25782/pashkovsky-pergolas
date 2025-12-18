/**
 * API route for material orders (חומר הוזמן)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { MaterialOrder, MaterialOrderCreate } from '@/types/material-order'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

function auth(req: NextRequest): boolean {
  const token = req.headers.get('x-admin-token')
  const expected = process.env.ADMIN_TOKEN
  return !!expected && token === expected
}

// GET - List material orders
export async function GET(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  if (!auth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const dealId = searchParams.get('dealId')

    if (!dealId) {
      return NextResponse.json({ error: 'dealId is required' }, { status: 400 })
    }

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
  } catch (error: any) {
    console.error('Error in GET /api/material-orders:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// POST - Create material order
export async function POST(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  if (!auth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body: MaterialOrderCreate = await req.json()

    if (!body.deal_id || !body.material_type) {
      return NextResponse.json(
        { error: 'deal_id and material_type are required' },
        { status: 400 }
      )
    }

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
  } catch (error: any) {
    console.error('Error in POST /api/material-orders:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

