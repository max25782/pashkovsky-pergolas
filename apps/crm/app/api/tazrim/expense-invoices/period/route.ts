import { NextRequest, NextResponse } from 'next/server'
import { resolveTazrimApi } from '@/lib/tazrim/expense-invoices/api-auth'
import { closeVatPeriod, reopenVatPeriod } from '@/lib/tazrim/expense-invoices/handlers'

export async function POST(req: NextRequest) {
  const auth = await resolveTazrimApi()
  if (!auth.ok) return auth.response
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body.period !== 'string') {
    return NextResponse.json({ error: 'bad_period' }, { status: 400 })
  }
  const note = typeof body.note === 'string' ? body.note : ''
  const result =
    body.action === 'reopen'
      ? await reopenVatPeriod(auth.ctx, body.period, note)
      : await closeVatPeriod(auth.ctx, body.period, note)
  return NextResponse.json(result.body, { status: result.status })
}
