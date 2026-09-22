/**
 * Public API endpoint for viewing offers
 * Does NOT require authentication - for customer approval pages
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { transformOfferFromDbRow } from '@/lib/pdf/map-offer-db-row-for-pdf'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// GET - Get single offer by ID (public, no auth required)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!supabase) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    )
  }

  try {
    // Fetch offer (public access - no company_id check)
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      console.error('Error fetching offer:', error)
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      )
    }

    // Transform to camelCase
    const offer = transformOfferFromDbRow(data as Record<string, unknown>)

    return NextResponse.json(offer)
  } catch (error: unknown) {
    console.error('Error in GET /api/public/offers/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
