import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCompanyId, getCompanyIdAsync } from '@/lib/middleware/company-context'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { loadCompanyVatPercent } from '@/lib/deals/company-vat'
import { laborByDeal, loadCompanyShifts, loadWorkerCostBook } from '@/lib/workers/load-cost-book'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

export interface DealFinanceContextResponse {
  /** company_settings.vat_percent (18 when never saved). */
  vatPercent: number
  /** Worker cost per deal id: employer cost with the coefficient, no VAT. */
  laborByDeal: Record<string, number>
}

/**
 * GET /admin-api/deals/finance-context
 * What the CRM needs besides the deals themselves to show VAT and net profit:
 * the company VAT rate and the labor cost of every deal, in one request.
 */
export async function GET(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  if (!supabase) return new Response('Missing Supabase env', { status: 500 })

  const companyId = getCompanyId(req) ?? (await getCompanyIdAsync(req)) ?? authCheck.context.companyId ?? null
  if (!companyId) return new Response('Unauthorized: No company context', { status: 401 })

  try {
    const shifts = await loadCompanyShifts(supabase, companyId, { dealLinkedOnly: true })

    const [vatPercent, book] = await Promise.all([
      loadCompanyVatPercent(supabase, companyId),
      loadWorkerCostBook(supabase, companyId),
    ])

    const body: DealFinanceContextResponse = {
      vatPercent,
      laborByDeal: laborByDeal(shifts, book),
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('GET finance-context error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to load finance context' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
