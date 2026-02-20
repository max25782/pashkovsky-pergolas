import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCompanyId, getCompanyIdAsync } from '@/lib/middleware/company-context'
import { requireAuthAsync } from '@/lib/middleware/auth-async'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// GET - List payments for a deal
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  if (!supabase) return new Response('Missing Supabase env', { status: 500 })

  const companyId = getCompanyId(req) ?? (await getCompanyIdAsync(req)) ?? authCheck.context.companyId ?? null
  if (!companyId) return new Response('Unauthorized: No company context', { status: 401 })

  const { id: dealId } = await context.params
  if (!dealId) return new Response('Missing deal id', { status: 400 })

  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, company_id')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) {
    return new Response(JSON.stringify({ error: 'Deal not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (deal.company_id !== companyId) {
    return new Response(JSON.stringify({ error: 'Deal not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data: payments, error } = await supabase
    .from('deal_payments')
    .select('*')
    .eq('deal_id', dealId)
    .eq('company_id', companyId)
    .order('paid_at', { ascending: false })

  if (error) {
    console.error('GET deal payments error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ payments: payments ?? [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

// POST - Create a payment for a deal
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  if (!supabase) return new Response('Missing Supabase env', { status: 500 })

  const companyId = getCompanyId(req) ?? (await getCompanyIdAsync(req)) ?? authCheck.context.companyId ?? null
  if (!companyId) return new Response('Unauthorized: No company context', { status: 401 })

  const { id: dealId } = await context.params
  if (!dealId) return new Response('Missing deal id', { status: 400 })

  let body: { amount?: number; paid_at?: string; notes?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return new Response(
      JSON.stringify({ error: 'amount is required and must be > 0' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id, company_id')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) {
    return new Response(JSON.stringify({ error: 'Deal not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (deal.company_id !== companyId) {
    return new Response(JSON.stringify({ error: 'Deal not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const paidAt = body.paid_at ? new Date(body.paid_at).toISOString() : new Date().toISOString()

  const { data: payment, error } = await supabase
    .from('deal_payments')
    .insert({
      deal_id: dealId,
      company_id: companyId,
      amount,
      paid_at: paidAt,
      notes: body.notes?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    console.error('POST deal payment error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(payment), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
}
