import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * PATCH /api/admin/inventory/[id]
 * Update qty_available, color, location for a stock row.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error
  const companyId = auth.context.companyId
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  if (body.qty_available !== undefined) updates.qty_available = parseInt(body.qty_available)
  if (body.color !== undefined) updates.color = body.color.trim()
  if (body.location !== undefined) updates.location = body.location?.trim() || null
  if (body.length_meters !== undefined) updates.length_meters = parseFloat(body.length_meters)

  const { data, error } = await supabase
    .from('stock')
    .update(updates)
    .eq('id', params.id)
    .eq('company_id', companyId)
    .select()
    .single()

  if (error) {
    console.error('[Inventory PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

/**
 * DELETE /api/admin/inventory/[id]
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error
  const companyId = auth.context.companyId
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 })

  const { error } = await supabase
    .from('stock')
    .delete()
    .eq('id', params.id)
    .eq('company_id', companyId)

  if (error) {
    console.error('[Inventory DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
