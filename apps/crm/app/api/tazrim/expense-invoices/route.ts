import { NextRequest, NextResponse } from 'next/server'
import { resolveTazrimApi } from '@/lib/tazrim/expense-invoices/api-auth'
import { listExpenseInvoices, uploadExpenseDocument } from '@/lib/tazrim/expense-invoices/handlers'

export async function GET() {
  const auth = await resolveTazrimApi()
  if (!auth.ok) return auth.response
  const result = await listExpenseInvoices(auth.ctx)
  return NextResponse.json(result.body, { status: result.status })
}

export async function POST(req: NextRequest) {
  const auth = await resolveTazrimApi()
  if (!auth.ok) return auth.response
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file_required' }, { status: 400 })
  }
  const result = await uploadExpenseDocument(auth.ctx, {
    filename: file.name,
    mimeType: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
  })
  return NextResponse.json(result.body, { status: result.status })
}
