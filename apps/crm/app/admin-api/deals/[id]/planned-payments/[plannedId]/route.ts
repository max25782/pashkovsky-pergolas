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

type RouteContext = { params: Promise<{ id: string; plannedId: string }> }

async function resolveRow(req: NextRequest, context: RouteContext) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return { error: authCheck.error as Response }
  if (!supabase) return { error: NextResponse.json({ error: 'Server not configured' }, { status: 500 }) }

  const companyId = getCompanyId(req) ?? (await getCompanyIdAsync(req)) ?? authCheck.context.companyId ?? null
  if (!companyId) return { error: NextResponse.json({ error: 'No company context' }, { status: 401 }) }

  const { id: dealId, plannedId } = await context.params
  if (!dealId || !plannedId) return { error: NextResponse.json({ error: 'Missing params' }, { status: 400 }) }

  // The row must belong to this firm and this deal.
  const { data, error } = await supabase
    .from('planned_payments')
    .select('id')
    .eq('id', plannedId)
    .eq('deal_id', dealId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (error) return { error: failure(error, 'lookup') }
  if (!data) return { error: NextResponse.json({ error: 'Planned payment not found' }, { status: 404 }) }
  return { companyId, dealId, plannedId }
}

function failure(error: { message: string; code?: string }, what: string): NextResponse {
  if (isMissingReportTable(error)) {
    return NextResponse.json({ error: 'Planned payments are not available yet', code: 'not_available' }, { status: 503 })
  }
  console.error(`planned-payments ${what} failed:`, error)
  return NextResponse.json({ error: error.message }, { status: 500 })
}

/** PATCH /admin-api/deals/:id/planned-payments/:plannedId  { amount?, due_date?, label? } */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const ctx = await resolveRow(req, context)
  if ('error' in ctx) return ctx.error

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { fields, errors } = parsePlannedPayment(body, 'update')
  if (errors.length > 0) return NextResponse.json({ error: 'Invalid planned payment', codes: errors }, { status: 400 })
  if (Object.keys(fields).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { data, error } = await supabase!
    .from('planned_payments')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', ctx.plannedId)
    .eq('company_id', ctx.companyId)
    .select(COLUMNS)
    .single()
  if (error) return failure(error, 'update')
  return NextResponse.json(data)
}

/** DELETE /admin-api/deals/:id/planned-payments/:plannedId */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const ctx = await resolveRow(req, context)
  if ('error' in ctx) return ctx.error

  const { error } = await supabase!
    .from('planned_payments')
    .delete()
    .eq('id', ctx.plannedId)
    .eq('company_id', ctx.companyId)
  if (error) return failure(error, 'delete')
  return NextResponse.json({ ok: true })
}
