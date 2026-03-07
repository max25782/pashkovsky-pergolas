import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAIDirectorAuth } from '@/lib/middleware/ai-director-auth'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY)
  : undefined

/**
 * GET /api/ai-director/data/material-orders
 *
 * Provides material orders / procurement data to Bedrock Agent
 * Query params:
 *   - company_id (required): Company ID for multi-tenant filtering
 *   - deal_id: Filter by deal id
 *   - status: ordered|confirmed|in_transit|delivered|cancelled
 *   - supplier_name: Filter by supplier name (exact)
 *   - start_date: Filter orders after this date (ISO 8601, by order_date)
 *   - end_date: Filter orders before this date (ISO 8601, by order_date)
 *   - limit: Maximum number of orders to return (default 50, max 100)
 */
export async function GET(req: NextRequest) {
  const authError = requireAIDirectorAuth(req)
  if (authError) return authError

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(req.url)

    const companyId = searchParams.get('company_id')
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 })
    }

    const dealId = searchParams.get('deal_id')
    const status = searchParams.get('status')
    const supplierName = searchParams.get('supplier_name')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    let query = supabase
      .from('material_orders')
      .select(
        [
          'id',
          'deal_id',
          'offer_id',
          'material_type',
          'material_description',
          'quantity',
          'unit',
          'supplier_name',
          'supplier_email',
          'supplier_phone',
          'order_date',
          'expected_delivery_date',
          'actual_delivery_date',
          'status',
          'unit_price',
          'total_price',
          'currency',
          'tracking_number',
          'tracking_url',
          'notes',
          'created_at',
          'updated_at',
        ].join(', ')
      )
      .eq('company_id', companyId)
      .order('order_date', { ascending: false })
      .limit(limit)

    if (dealId) query = query.eq('deal_id', dealId)
    if (status) query = query.eq('status', status)
    if (supplierName) query = query.eq('supplier_name', supplierName)
    if (startDate) query = query.gte('order_date', startDate)
    if (endDate) query = query.lte('order_date', endDate)

    const { data, error } = await query
    if (error) {
      console.error('[AI Director] Error fetching material orders:', error)
      return NextResponse.json({ error: 'Failed to fetch material orders' }, { status: 500 })
    }

    return NextResponse.json({
      material_orders: data || [],
      count: data?.length || 0,
    })
  } catch (error) {
    console.error('[AI Director] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}





