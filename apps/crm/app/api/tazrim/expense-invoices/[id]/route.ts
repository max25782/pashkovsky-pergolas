import { NextRequest, NextResponse } from 'next/server'
import { resolveTazrimApi } from '@/lib/tazrim/expense-invoices/api-auth'
import {
  confirmExpenseInvoice,
  parseDraftBody,
  rejectExpenseInvoice,
} from '@/lib/tazrim/expense-invoices/handlers'

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const auth = await resolveTazrimApi()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  if (body.action === 'reject') {
    const result = await rejectExpenseInvoice(auth.ctx, id)
    return NextResponse.json(result.body, { status: result.status })
  }
  const draft = parseDraftBody(body)
  if (!draft) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const result = await confirmExpenseInvoice(auth.ctx, id, draft)
  return NextResponse.json(result.body, { status: result.status })
}
