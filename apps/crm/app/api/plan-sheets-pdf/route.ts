import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { renderSheetHtmlToPdfBuffer } from '@/lib/pdf/render-sheet-pdf'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  const body = await req.json() as { html?: string; filename?: string }
  const html = body.html
  if (!html || html.length > 8_000_000) {
    return NextResponse.json({ error: 'Missing sheet HTML' }, { status: 400 })
  }
  const filename = (body.filename ?? 'plan-sheets.pdf').replace(/[^a-zA-Z0-9._-]/g, '')

  try {
    const pdf = await renderSheetHtmlToPdfBuffer(html)
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename || 'plan-sheets.pdf'}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[plan-sheets-pdf]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to render PDF' },
      { status: 500 },
    )
  }
}
