import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAIDirectorAuth } from '@/lib/middleware/ai-director-auth'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY)
  : undefined

/**
 * GET /api/ai-director/data/offers
 *
 * Provides offers/quotes data to Bedrock Agent
 * Query params:
 *   - company_id (required): Company ID for multi-tenant filtering
 *   - deal_id: Filter by deal id
 *   - approved: Filter by approval (true/false)
 *   - start_date: Filter offers created after this date (ISO 8601)
 *   - end_date: Filter offers created before this date (ISO 8601)
 *   - limit: Maximum number of offers to return (default 50, max 100)
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
    const approvedParam = (searchParams.get('approved') || '').trim()
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    let query = supabase
      .from('offers')
      .select(
        [
          'id',
          'deal_id',
          'customer_name',
          'customer_phone',
          'customer_city',
          'approved',
          'approved_at',
          'final_price',
          'price_with_vat',
          'vat_percent',
          'discount_percent',
          'pdf_url',
          'created_at',
          'updated_at',
        ].join(', ')
      )
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (dealId) query = query.eq('deal_id', dealId)
    if (approvedParam === 'true') query = query.eq('approved', true)
    if (approvedParam === 'false') query = query.eq('approved', false)
    if (startDate) query = query.gte('created_at', startDate)
    if (endDate) query = query.lte('created_at', endDate)

    const { data, error } = await query
    if (error) {
      console.error('[AI Director] Error fetching offers:', error)
      return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 })
    }

    return NextResponse.json({
      offers: data || [],
      count: data?.length || 0,
    })
  } catch (error: any) {
    console.error('[AI Director] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}





