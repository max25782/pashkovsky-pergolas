import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { fetchWithTimeout, DEFAULT_SUPABASE_TIMEOUT_MS } from '@/lib/supabase/fetch-with-timeout'
import { pdfLocaleFromCompanySettings } from '@/lib/pdf/company-pdf-locale'
import { resolvePdfLocale, type PdfLocale } from '@/lib/pdf/pdf-locale'
import { EMPTY_FIRM_PROFILE, firmProfileFromRow, type FirmProfile } from '@/lib/company/firm-profile'

export const dynamic = 'force-dynamic'

type Company = {
  id: string
  name: string
  status: string
  created_at: string
}

/** PostgREST embed for `companies(...)` is typed as an object or a single-element array. */
type MembershipRow = {
  role: string
  company_id: string
  crm_intro_completed_at?: string | null
  companies: Company | Company[] | null
}

const MEMBERSHIP_SELECT_WITH_INTRO =
  'role, company_id, crm_intro_completed_at, companies(id, name, status, created_at)'
const MEMBERSHIP_SELECT_BASE = 'role, company_id, companies(id, name, status, created_at)'

function isMissingCrmIntroColumn(err: { code?: string; message?: string } | null): boolean {
  return (
    err?.code === '42703' &&
    (err.message?.includes('crm_intro_completed_at') ?? false)
  )
}

function companyFromMembership(row: MembershipRow): Company | null {
  const nested = row.companies
  if (nested == null) return null
  return Array.isArray(nested) ? (nested[0] ?? null) : nested
}

export async function GET() {
  try {
    
    const supabase = createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }


    // Use service role to fetch memberships with company data (bypasses RLS)
    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        // See lib/supabase/fetch-with-timeout.ts — the "401 in 1084724ms"
        // (~18min) incident this route caused: bound every network call
        // this client makes, not just auth.getUser() above.
        global: { fetch: fetchWithTimeout(DEFAULT_SUPABASE_TIMEOUT_MS) },
      }
    )

    let first = await service
      .from('company_members')
      .select(MEMBERSHIP_SELECT_WITH_INTRO)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)

    let membershipsError = first.error
    let rows: MembershipRow[] | null = first.data as MembershipRow[] | null

    if (membershipsError && isMissingCrmIntroColumn(membershipsError)) {
      const retry = await service
        .from('company_members')
        .select(MEMBERSHIP_SELECT_BASE)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
      membershipsError = retry.error
      rows = retry.data as MembershipRow[] | null
      if (!membershipsError) {
        console.warn(
          '[companies/me] company_members.crm_intro_completed_at missing; apply migration 046_company_members_crm_intro.sql — intro completion will not persist server-side until then.',
        )
      }
    }

    if (membershipsError) {
      console.error('[companies/me] company_members query:', membershipsError)
      return NextResponse.json({ error: 'Company lookup failed', details: membershipsError.message }, { status: 500 })
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const chosen = rows[0] as unknown as MembershipRow
    const company = companyFromMembership(chosen)
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    return NextResponse.json({
      company_id: company.id,
      company_name: company.name,
      role: chosen.role,
      status: company.status,
      crm_intro_completed_at: chosen.crm_intro_completed_at ?? null,
      language: await readCompanyLanguage(service, company.id),
      profile: await readFirmProfile(service, company.id),
    })
  } catch (error: unknown) {
    const e = error as Error & { stack?: string }
    console.error('[companies/me] Unexpected error:', error)
    console.error('[companies/me] Error stack:', e?.stack)
    // Always return valid JSON, never throw
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

async function readFirmProfile(service: SupabaseClient, companyId: string): Promise<FirmProfile> {
  try {
    const { data, error } = await service.from('companies').select('*').eq('id', companyId).maybeSingle()
    if (error) {
      console.error('[companies/me] firm profile query:', error)
      return EMPTY_FIRM_PROFILE
    }
    return firmProfileFromRow(data as Record<string, unknown> | null)
  } catch (error) {
    console.error('[companies/me] firm profile failed:', error)
    return EMPTY_FIRM_PROFILE
  }
}

async function readCompanyLanguage(
  service: SupabaseClient,
  companyId: string,
): Promise<PdfLocale> {
  try {
    const { data, error } = await service.from('companies').select('settings').eq('id', companyId).maybeSingle()
    if (error || !data) return 'he'
    return pdfLocaleFromCompanySettings(data.settings) ?? 'he'
  } catch {
    return 'he'
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json() as { language?: unknown }
    if (typeof body.language !== 'string') {
      return NextResponse.json({ error: 'language required' }, { status: 400 })
    }
    const language = resolvePdfLocale(body.language)
    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: fetchWithTimeout(DEFAULT_SUPABASE_TIMEOUT_MS) },
      },
    )
    const { data: membership, error: membershipError } = await service
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (membershipError || !membership?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }
    const { data: current } = await service
      .from('companies')
      .select('settings')
      .eq('id', membership.company_id)
      .maybeSingle()
    const settings = current?.settings && typeof current.settings === 'object'
      ? { ...(current.settings as Record<string, unknown>) }
      : {}
    settings.language = language
    const { error: updateError } = await service
      .from('companies')
      .update({ settings })
      .eq('id', membership.company_id)
    if (updateError) {
      return NextResponse.json({ error: 'Could not save language' }, { status: 500 })
    }
    return NextResponse.json({ language })
  } catch (error: unknown) {
    console.error('[companies/me] PATCH', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
