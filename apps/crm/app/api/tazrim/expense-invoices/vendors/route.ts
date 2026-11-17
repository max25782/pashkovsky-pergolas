import { NextRequest, NextResponse } from 'next/server'
import { resolveTazrimApi } from '@/lib/tazrim/expense-invoices/api-auth'
import { createSupplierVendor } from '@/lib/tazrim/expense-invoices/handlers'

export async function POST(req: NextRequest) {
  const auth = await resolveTazrimApi()
  if (!auth.ok) return auth.response
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'name_required' }, { status: 400 })
  }
  const invoiceId = typeof body.invoiceId === 'string' ? body.invoiceId : null
  const result = await createSupplierVendor(auth.ctx, { name: body.name, invoiceId })
  return NextResponse.json(result.body, { status: result.status })
}
