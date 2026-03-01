import { NextResponse } from 'next/server'

export async function GET() {
  // Read env var INSIDE the handler to guarantee runtime evaluation
  const PROFILES_API_URL = process.env.PROFILES_API_URL || 'http://localhost:3002'

  // Collect all env var keys that look related (for diagnostics)
  const relatedEnvKeys = Object.keys(process.env).filter(
    (k) => k.includes('PROFILES') || k.includes('API_URL') || k.includes('NEST'),
  )
  const relatedEnvValues: Record<string, string> = {}
  for (const key of relatedEnvKeys) {
    relatedEnvValues[key] = process.env[key] ?? '(undefined)'
  }

  const healthUrl = `${PROFILES_API_URL.replace(/\/$/, '')}/health`
  const companyId = process.env.DEFAULT_COMPANY_ID || '6998295e-89ae-4e3d-afd2-8c2b0333eac2'
  const profilesUrl = `${PROFILES_API_URL.replace(/\/$/, '')}/profiles?company_id=${companyId}`

  let healthResult: Record<string, unknown> = {}
  let profilesResult: Record<string, unknown> = {}

  try {
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) })
    healthResult = { status: res.status, ok: res.ok, body: await res.text().catch(() => '') }
  } catch (e: any) {
    healthResult = { error: e?.message }
  }

  try {
    const res = await fetch(profilesUrl, { signal: AbortSignal.timeout(5000) })
    const text = await res.text().catch(() => '')
    profilesResult = { status: res.status, ok: res.ok, body: text.slice(0, 300) }
  } catch (e: any) {
    profilesResult = { error: e?.message }
  }

  return NextResponse.json({
    PROFILES_API_URL,
    healthUrl,
    profilesUrl,
    relatedEnvKeys: relatedEnvValues,
    health: healthResult,
    profiles: profilesResult,
  })
}
