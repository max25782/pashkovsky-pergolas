import { NextRequest, NextResponse } from 'next/server'
import { resolveTazrimApi } from '@/lib/tazrim/expense-invoices/api-auth'
import { completeDirectInvoiceUpload, createDirectInvoiceUpload } from '@/lib/tazrim/expense-invoices/handlers'

export async function POST(req: NextRequest) {
  const auth = await resolveTazrimApi()
  if (!auth.ok) return auth.response
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  if (body.action === 'sign') {
    const filename = typeof body.filename === 'string' ? body.filename : ''
    const size = typeof body.size === 'number' ? body.size : Number(body.size)
    const result = await createDirectInvoiceUpload(auth.ctx, { filename, size })
    return NextResponse.json(result.body, { status: result.status })
  }
  if (body.action === 'complete') {
    const path = typeof body.path === 'string' ? body.path : ''
    const filename = typeof body.filename === 'string' ? body.filename : 'invoice.pdf'
    const dealId = typeof body.dealId === 'string' ? body.dealId : null
    const docKind = body.docKind === 'tax_invoice' || body.docKind === 'preliminary' ? body.docKind : null
    const result = await completeDirectInvoiceUpload(auth.ctx, { path, filename, dealId, docKind })
    return NextResponse.json(result.body, { status: result.status })
  }
  return NextResponse.json({ error: 'invalid' }, { status: 400 })
}
