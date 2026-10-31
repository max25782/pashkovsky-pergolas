import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { transformOfferFromDbRowForApi } from '@/lib/pdf/map-offer-db-row-for-pdf'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// GET - Get offers for a deal
export async function GET(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(req.url)
  const dealId = searchParams.get('dealId')

  if (!dealId) {
    return NextResponse.json(
      { error: 'Deal ID is required' },
      { status: 400 }
    )
  }

  try {
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching offers:', error)
      return NextResponse.json(
        { error: 'Failed to fetch offers', details: error.message },
        { status: 500 }
      )
    }

    // Transform to camelCase
    const offers = data.map((row) => transformOfferFromDbRowForApi(row as Record<string, unknown>))

    return NextResponse.json({ offers })
  } catch (error: unknown) {
    console.error('Error in GET /api/offers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
