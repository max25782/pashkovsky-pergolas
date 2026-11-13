import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCompanyId, getCompanyIdAsync } from '@/lib/middleware/company-context'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { parsePlannedPayment } from '@/lib/reports/planned-payment-input'
import { isMissingReportTable } from '@/lib/reports/missing-table'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

const COLUMNS = 'id, deal_id, amount, due_date, label, created_at'

type RouteContext = { params: Promise<{ id: string }> }

async function resolveDeal(req: NextRequest, context: RouteContext) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return { error: authCheck.error as Response }
  if (!supabase) return { error: NextResponse.json({ error: 'Server not configured' }, { status: 500 }) }

  const companyId = getCompanyId(req) ?? (await getCompanyIdAsync(req)) ?? authCheck.context.companyId ?? null
  if (!companyId) return { error: NextResponse.json({ error: 'No company context' }, { status: 401 }) }

  const { id: dealId } = await context.params
  if (!dealId) return { error: NextResponse.json({ error: 'Missing deal id' }, { status: 400 }) }

  const { data: deal, error } = await supabase
    .from('deals')
    .select('id')
    .eq('id', dealId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (error) {
    console.error('planned-payments deal lookup failed:', error)
    return { error: NextResponse.json({ error: 'Failed to load deal' }, { status: 500 }) }
  }
  if (!deal) return { error: NextResponse.json({ error: 'Deal not found' }, { status: 404 }) }
  return { companyId, dealId }
}

function failure(error: { message: string; code?: string }, what: string): NextResponse {
  if (isMissingReportTable(error)) {
    return NextResponse.json({ error: 'Planned payments are not available yet', code: 'not_available' }, { status: 503 })
  }
  console.error(`planned-payments ${what} failed:`, error)
  return NextResponse.json({ error: error.message }, { status: 500 })
}

/** GET /admin-api/deals/:id/planned-payments */
export async function GET(req: NextRequest, context: RouteContext) {
  const ctx = await resolveDeal(req, context)
  if ('error' in ctx) return ctx.error

  const { data, error } = await supabase!
    .from('planned_payments')
    .select(COLUMNS)
    .eq('deal_id', ctx.dealId)
    .eq('company_id', ctx.companyId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  if (error) return failure(error, 'list')
  return NextResponse.json({ plannedPayments: data ?? [] })
}

/** POST /admin-api/deals/:id/planned-payments  { amount, due_date?, label? } */
export async function POST(req: NextRequest, context: RouteContext) {
  const ctx = await resolveDeal(req, context)
  if ('error' in ctx) return ctx.error

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { fields, errors } = parsePlannedPayment(body, 'create')
  if (errors.length > 0) return NextResponse.json({ error: 'Invalid planned payment', codes: errors }, { status: 400 })

  const { data, error } = await supabase!
    .from('planned_payments')
    .insert({ ...fields, deal_id: ctx.dealId, company_id: ctx.companyId })
    .select(COLUMNS)
    .single()
  if (error) return failure(error, 'create')
  return NextResponse.json(data, { status: 201 })
}
