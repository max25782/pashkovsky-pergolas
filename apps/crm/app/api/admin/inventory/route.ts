import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/admin/inventory
 * Returns all stock rows joined with aluminum_profiles for the company.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error
  const companyId = auth.context.companyId
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 })

  const { data, error } = await supabase
    .from('stock')
    .select(`
      id,
      color,
      length_meters,
      qty_available,
      qty_reserved,
      qty_used,
      location,
      updated_at,
      aluminum_profiles (
        id,
        code,
        name_he,
        name_ru,
        name_en,
        weight_per_meter,
        dimensions,
        category
      )
    `)
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[Inventory GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

/**
 * POST /api/admin/inventory
 * Create a new stock entry.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error
  const companyId = auth.context.companyId
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 })

  const body = await req.json()
  const { profile_id, color, length_meters, qty_available, location } = body

  if (!profile_id || !color || !length_meters) {
    return NextResponse.json({ error: 'profile_id, color, length_meters are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('stock')
    .insert({
      company_id: companyId,
      profile_id,
      color: color.trim(),
      length_meters: parseFloat(length_meters),
      qty_available: parseInt(qty_available ?? 0),
      qty_reserved: 0,
      qty_used: 0,
      location: location?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    console.error('[Inventory POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
