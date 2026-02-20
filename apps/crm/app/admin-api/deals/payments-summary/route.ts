import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCompanyId, getCompanyIdAsync } from '@/lib/middleware/company-context'
import { requireAuthAsync } from '@/lib/middleware/auth-async'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

export interface PaymentRow {
  id: string
  deal_id: string
  amount: number
  paid_at: string
}

/**
 * GET /admin-api/deals/payments-summary
 * Returns all payments for the company (for stats aggregation)
 */
export async function GET(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  if (!supabase) return new Response('Missing Supabase env', { status: 500 })

  const companyId = getCompanyId(req) ?? (await getCompanyIdAsync(req)) ?? authCheck.context.companyId ?? null
  if (!companyId) return new Response('Unauthorized: No company context', { status: 401 })

  const { data: payments, error } = await supabase
    .from('deal_payments')
    .select('id, deal_id, amount, paid_at')
    .eq('company_id', companyId)
    .order('paid_at', { ascending: true })

  if (error) {
    console.error('GET payments-summary error:', error)
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
