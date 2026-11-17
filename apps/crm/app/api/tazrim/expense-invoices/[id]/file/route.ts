import { NextResponse } from 'next/server'
import { resolveTazrimApi } from '@/lib/tazrim/expense-invoices/api-auth'
import { signedInvoiceUrl } from '@/lib/tazrim/expense-invoices/handlers'

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const auth = await resolveTazrimApi()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const result = await signedInvoiceUrl(auth.ctx, id)
  return NextResponse.json(result.body, { status: result.status })
}
