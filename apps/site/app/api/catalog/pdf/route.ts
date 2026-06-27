import { NextRequest, NextResponse } from 'next/server'
import { createBrowser } from '@/lib/pdf/create-browser'
import { pdfLimiter, checkLimit, getClientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function resolveBaseUrl(req: NextRequest): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (explicit) return explicit
  const vercel = process.env.VERCEL_URL
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  if (host) return `${proto}://${host}`
  return 'http://localhost:3000'
}

/**
 * GET /api/catalog/pdf
 * Renders the Hebrew catalog page (?pdf=1) and returns an A4 PDF.
 * Query params are forwarded to the page (e.g. sections=pergola_classic,fences).
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = await checkLimit(pdfLimiter, ip)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many PDF requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    )
  }

  let page = null
  try {
    const base = resolveBaseUrl(req)
    const forward = new URLSearchParams()
    forward.set('pdf', '1')
    const sections = req.nextUrl.searchParams.get('sections')
    if (sections) forward.set('sections', sections)

    const catalogUrl = `${base}/he/catalog?${forward.toString()}`
    const browser = await createBrowser()
    page = await browser.newPage()
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'he-IL,he;q=0.9',
    })

    await page.goto(catalogUrl, { waitUntil: 'networkidle0', timeout: 120_000 })
    await page.waitForSelector('[data-catalog-ready="true"]', { timeout: 60_000 }).catch(() => {
      console.warn('[catalog/pdf] data-catalog-ready not found, continuing')
    })

    await page.emulateMediaType('print')

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
      preferCSSPageSize: false,
    })

    await page.close()
    page = null

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="pashkovsky-catalog.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[api/catalog/pdf]', e)
    if (page) {
      try {
        await page.close()
      } catch {
        /* ignore */
      }
    }
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
  }
}
