import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { fetchWithTimeout, DEFAULT_SUPABASE_TIMEOUT_MS } from '@/lib/supabase/fetch-with-timeout'

export const dynamic = 'force-dynamic'

interface MemberRow {
  user_id: string
}

interface UserRow {
  id: string
  full_name: string | null
  email: string | null
}

/**
 * GET /api/companies/members
 * Display names of the signed-in user's company members, keyed by user id.
 * Used to turn deals.created_by (an auth user id) into a readable name on the board.
 */
export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Service role bypasses RLS; the company is derived from the caller's own membership.
    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: fetchWithTimeout(DEFAULT_SUPABASE_TIMEOUT_MS) },
      },
    )

    const { data: own, error: ownError } = await service
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
    if (ownError) {
      console.error('[companies/members] own membership query:', ownError)
      return NextResponse.json({ error: 'Company lookup failed' }, { status: 500 })
    }
    const companyId = own?.[0]?.company_id as string | undefined
    if (!companyId) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

    const { data: members, error: membersError } = await service
      .from('company_members')
      .select('user_id')
      .eq('company_id', companyId)
    if (membersError) {
      console.error('[companies/members] members query:', membersError)
      return NextResponse.json({ error: 'Members lookup failed' }, { status: 500 })
    }

    const userIds = ((members ?? []) as MemberRow[]).map((m) => m.user_id)
    if (userIds.length === 0) return NextResponse.json({ names: {} })

    const { data: users, error: usersError } = await service
      .from('users')
      .select('id, full_name, email')
      .in('id', userIds)
    if (usersError) {
      console.error('[companies/members] users query:', usersError)
      return NextResponse.json({ error: 'Users lookup failed' }, { status: 500 })
    }

    const names: Record<string, string> = {}
    for (const u of (users ?? []) as UserRow[]) {
      const label = u.full_name?.trim() || u.email?.trim()
      if (label) names[u.id] = label
    }
    return NextResponse.json({ names })
  } catch (error: unknown) {
    console.error('[companies/members] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
