import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requirePermissionAsync } from '@/lib/middleware/auth'
import {
  applySettingsUpdate,
  type ReportLanguage,
  type WeeklyReportSettings,
} from '@/lib/reports/weekly-report-settings'
import {
  loadFirmReportIdentity,
  loadOwnerAdminEmails,
  loadReportSettings,
  resolveReportLanguage,
  saveReportSettings,
} from '@/lib/reports/weekly-report-store'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

export interface WeeklyReportSettingsResponse {
  /** False until migration 065 is applied: nothing can be saved or sent. */
  available: boolean
  settings: WeeklyReportSettings
  /** The language the report is sent in now (the setting, else the firm's language). */
  effectiveLanguage: ReportLanguage
  /** Who gets it when no single recipient is set. */
  ownerAdminEmails: string[]
}

async function buildResponse(companyId: string): Promise<WeeklyReportSettingsResponse | null> {
  if (!supabase) return null
  const settings = await loadReportSettings(supabase, companyId)
  const identity = await loadFirmReportIdentity(supabase, companyId)
  const ownerAdminEmails = await loadOwnerAdminEmails(supabase, companyId)
  if (!settings) {
    const fallback: WeeklyReportSettings = {
      enabled: true,
      recipientEmail: null,
      weekday: 0,
      hour: 8,
      timezone: 'Asia/Jerusalem',
      language: null,
    }
    return {
      available: false,
      settings: fallback,
      effectiveLanguage: resolveReportLanguage(fallback, identity),
      ownerAdminEmails,
    }
  }
  return {
    available: true,
    settings,
    effectiveLanguage: resolveReportLanguage(settings, identity),
    ownerAdminEmails,
  }
}

/** GET /admin-api/weekly-report/settings: owner and admin only. */
export async function GET(req: NextRequest) {
  const permission = await requirePermissionAsync(req, 'weekly_report:edit')
  if (!permission.authorized) return permission.error as NextResponse
  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  const companyId = permission.companyId
  if (!companyId) return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })

  try {
    return NextResponse.json(await buildResponse(companyId))
  } catch (error) {
    console.error('GET weekly-report settings error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load settings' },
      { status: 500 },
    )
  }
}

/** PUT /admin-api/weekly-report/settings: owner and admin save; invalid fields give 400 with codes. */
export async function PUT(req: NextRequest) {
  const permission = await requirePermissionAsync(req, 'weekly_report:edit')
  if (!permission.authorized) return permission.error as NextResponse
  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  const companyId = permission.companyId
  if (!companyId) return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const current = await loadReportSettings(supabase, companyId)
    if (!current) {
      return NextResponse.json({ error: 'Weekly report is not available yet', code: 'not_available' }, { status: 503 })
    }
    const { settings, errors } = applySettingsUpdate(current, body)
    if (errors.length > 0) return NextResponse.json({ error: 'Invalid settings', codes: errors }, { status: 400 })
    await saveReportSettings(supabase, companyId, settings)
    return NextResponse.json(await buildResponse(companyId))
  } catch (error) {
    console.error('PUT weekly-report settings error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save settings' },
      { status: 500 },
    )
  }
}
