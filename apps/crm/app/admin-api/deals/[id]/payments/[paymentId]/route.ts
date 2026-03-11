import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCompanyId, getCompanyIdAsync } from '@/lib/middleware/company-context'
import { requireAuthAsync } from '@/lib/middleware/auth-async'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

type RouteContext = { params: Promise<{ id: string; paymentId: string }> }

async function resolveContext(req: NextRequest, context: RouteContext) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return { ok: false as const, error: authCheck.error }

  if (!supabase) return { ok: false as const, error: new Response('Missing Supabase env', { status: 500 }) }

  const companyId = getCompanyId(req) ?? (await getCompanyIdAsync(req)) ?? authCheck.context.companyId ?? null
  if (!companyId) return { ok: false as const, error: new Response('Unauthorized: No company context', { status: 401 }) }

  const { id: dealId, paymentId } = await context.params
  if (!dealId || !paymentId) return { ok: false as const, error: new Response('Missing params', { status: 400 }) }

  // Verify payment belongs to this company and deal
  const { data: payment, error } = await supabase
    .from('deal_payments')
    .select('id, deal_id, company_id')
    .eq('id', paymentId)
    .eq('deal_id', dealId)
    .eq('company_id', companyId)
    .single()

  if (error || !payment) {
    return { ok: false as const, error: new Response(JSON.stringify({ error: 'Payment not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }) }
  }

  return { ok: true as const, companyId, dealId, paymentId }
}

// PATCH — update amount, paid_at, or notes
export async function PATCH(req: NextRequest, context: RouteContext) {
  const ctx = await resolveContext(req, context)
  if (!ctx.ok) return ctx.error

  let body: { amount?: number; paid_at?: string; notes?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body.amount !== undefined) {
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return new Response(JSON.stringify({ error: 'amount must be > 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }
    updates.amount = amount
  }
  if (body.paid_at !== undefined) updates.paid_at = new Date(body.paid_at).toISOString()
  if (body.notes !== undefined) updates.notes = body.notes.trim() || null

  if (Object.keys(updates).length === 0) {
    return new Response(JSON.stringify({ error: 'No fields to update' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const { data, error } = await supabase!
    .from('deal_payments')
    .update(updates)
    .eq('id', ctx.paymentId)
    .select()
    .single()

  if (error) {
    console.error('PATCH deal payment error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

// DELETE — remove a payment
export async function DELETE(req: NextRequest, context: RouteContext) {
  const ctx = await resolveContext(req, context)
  if (!ctx.ok) return ctx.error

  const { error } = await supabase!
    .from('deal_payments')
    .delete()
    .eq('id', ctx.paymentId)

  if (error) {
    console.error('DELETE deal payment error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
