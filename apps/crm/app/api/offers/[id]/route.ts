import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { transformOfferFromDbRowForApi } from '@/lib/pdf/map-offer-db-row-for-pdf'
import { requireCompanyAccess } from '@/lib/auth'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

type OfferRouteParams = { id: string }

async function resolveOfferParams(
  params: OfferRouteParams | Promise<OfferRouteParams>,
): Promise<OfferRouteParams> {
  return await Promise.resolve(params)
}

/** True if table/column is missing in this database (old migrations). */
function isIgnorableSchemaError(err: { code?: string; message?: string } | null): boolean {
  if (err === null) return false
  const c = err.code ?? ''
  const m = err.message ?? ''
  return (
    c === '42P01' ||
    c === 'PGRST205' ||
    m.includes('does not exist') ||
    m.includes('schema cache')
  )
}

/**
 * Remove / detach rows that reference offers so DELETE is not blocked by FKs
 * (e.g. DBs where ON DELETE CASCADE / SET NULL was never applied).
 */
async function detachOfferRelations(offerId: string): Promise<{ errorMessage: string | null }> {
  if (!supabase) return { errorMessage: 'Server not configured' }

  let { error: subErr } = await supabase
    .from('pergola_config_submissions')
    .update({ offer_id: null })
    .eq('offer_id', offerId)
  if (subErr !== null && !isIgnorableSchemaError(subErr)) {
    const { error: delSubErr } = await supabase.from('pergola_config_submissions').delete().eq('offer_id', offerId)
    if (delSubErr !== null && !isIgnorableSchemaError(delSubErr)) {
      return { errorMessage: delSubErr.message }
    }
  }

  const { error: tokErr } = await supabase.from('configurator_link_tokens').delete().eq('offer_id', offerId)
  if (tokErr !== null && !isIgnorableSchemaError(tokErr)) {
    return { errorMessage: tokErr.message }
  }

  const { error: moErr } = await supabase.from('material_orders').update({ offer_id: null }).eq('offer_id', offerId)
  if (moErr !== null && !isIgnorableSchemaError(moErr)) {
    return { errorMessage: moErr.message }
  }

  return { errorMessage: null }
}

// GET - Get single offer by ID
export async function GET(
  req: NextRequest,
  context: { params: OfferRouteParams | Promise<OfferRouteParams> },
) {
  const params = await resolveOfferParams(context.params)
  // 🔒 Security: Require authentication
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  if (!supabase) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    )
  }

  try {
    // Fetch offer
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching offer:', error)
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      )
    }

    // 🔒 Security: Verify company access
    const access = await requireCompanyAccess(req, data.company_id)
    if (!access.authorized) return access.error

    // Transform to camelCase
    const offer = transformOfferFromDbRowForApi(data as Record<string, unknown>)

    return NextResponse.json(offer)
  } catch (error: unknown) {
    console.error('Error in GET /api/offers/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Remove single offer by ID
export async function DELETE(
  req: NextRequest,
  context: { params: OfferRouteParams | Promise<OfferRouteParams> },
) {
  // 🔒 Security: Require authentication
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  if (!supabase) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    )
  }

  try {
    const params = await resolveOfferParams(context.params)
    const offerId = params.id
    if (offerId === undefined || offerId === '') {
      return NextResponse.json({ error: 'Missing offer id' }, { status: 400 })
    }

    // 🔒 Security: Fetch offer first to verify ownership
    const { data: offer, error: fetchError } = await supabase
      .from('offers')
      .select('company_id')
      .eq('id', offerId)
      .single()

    if (fetchError !== null || offer === null || offer === undefined) {
      console.error('Error fetching offer for deletion:', fetchError)
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      )
    }

    // 🔒 Security: Verify company access
    const access = await requireCompanyAccess(req, offer.company_id)
    if (!access.authorized) return access.error

    const detach = await detachOfferRelations(offerId)
    if (detach.errorMessage !== null) {
      console.error('[DELETE offer] detach relations failed:', detach.errorMessage)
      return NextResponse.json(
        { error: 'Failed to detach related records', details: detach.errorMessage },
        { status: 500 },
      )
    }

    const { error: delErr } = await supabase.from('offers').delete().eq('id', offerId)

    if (delErr !== null) {
      console.error('Error deleting offer:', delErr)
      return NextResponse.json(
        { error: 'Failed to delete offer', details: delErr.message, code: delErr.code },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error in DELETE /api/offers/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
