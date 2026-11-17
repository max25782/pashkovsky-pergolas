import { NextRequest, NextResponse } from 'next/server'
import { resolveTazrimApi } from '@/lib/tazrim/expense-invoices/api-auth'
import {
  applyInvoiceMatch,
  createExpenseFromInvoice,
  loadReconciliation,
  unlinkExpenseMatch,
} from '@/lib/tazrim/expense-invoices/handlers'

export async function GET(req: NextRequest) {
  const auth = await resolveTazrimApi()
  if (!auth.ok) return auth.response
  const period = new URL(req.url).searchParams.get('period') ?? ''
  const result = await loadReconciliation(auth.ctx, period)
  return NextResponse.json(result.body, { status: result.status })
}

export async function POST(req: NextRequest) {
  const auth = await resolveTazrimApi()
  if (!auth.ok) return auth.response
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body.invoiceId !== 'string') {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  if (body.action === 'create') {
    const result = await createExpenseFromInvoice(auth.ctx, body.invoiceId)
    return NextResponse.json(result.body, { status: result.status })
  }
  if (body.action === 'match' && typeof body.expenseId === 'string') {
    const result = await applyInvoiceMatch(auth.ctx, body.invoiceId, body.expenseId)
    return NextResponse.json(result.body, { status: result.status })
  }
  if (body.action === 'unlink') {
    const result = await unlinkExpenseMatch(auth.ctx, body.invoiceId)
    return NextResponse.json(result.body, { status: result.status })
  }
  return NextResponse.json({ error: 'invalid' }, { status: 400 })
}
