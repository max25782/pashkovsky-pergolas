import { readFile } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Serves aluminum profiles for the embedded configurator. Prefer a copy under
 * `apps/crm/public/data/profiles.json` so the browser never calls the marketing origin (no CORS).
 * If the file is missing (e.g. custom deploy), falls back to fetching the marketing site.
 */
export async function GET() {
  const localPath = path.join(process.cwd(), 'public', 'data', 'profiles.json')
  try {
    const raw = await readFile(localPath, 'utf8')
    return NextResponse.json(JSON.parse(raw) as unknown)
  } catch {
    /* fall through */
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (!site) {
    return NextResponse.json(
      {
        error:
          'Missing profiles: add apps/crm/public/data/profiles.json or set NEXT_PUBLIC_SITE_URL for fallback fetch',
        profiles: [],
      },
      { status: 500 },
    )
  }
  try {
    const r = await fetch(`${site}/data/profiles.json`, { cache: 'no-store' })
    if (!r.ok) {
      return NextResponse.json(
        { error: `Upstream profiles: HTTP ${r.status}`, profiles: [] },
        { status: 502 },
      )
    }
    return NextResponse.json((await r.json()) as unknown)
  } catch (e) {
    console.error('[api/configurator/profiles] remote fetch', e)
    return NextResponse.json(
      { error: 'Failed to load profiles from marketing site', profiles: [] },
      { status: 502 },
    )
  }
}
