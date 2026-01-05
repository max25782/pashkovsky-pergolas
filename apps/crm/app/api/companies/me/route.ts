import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Membership = {
  company_id: string
  role: string
  companies: {
    name: string
    created_at: string
    status: string
  }
}

export async function GET() {
  try {
    const supabase = createClient()

    // 1. Получаем текущего пользователя
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Получаем все компании, где состоит пользователь
    const { data: memberships, error: memberError } = await supabase
      .from('company_members')
      .select(
        `
          company_id,
          role,
          companies!inner (
            name,
            created_at,
            status
          )
        `
      )
      .eq('user_id', user.id) as { data: Membership[] | null; error: any }

    if (memberError) {
      console.error('[companies/me] memberError:', memberError)
      return NextResponse.json(
        { error: 'Failed to load company memberships' },
        { status: 500 }
      )
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // 3. Выбираем самую новую компанию, где пользователь owner,
    // иначе просто самую новую компанию
    const owners = memberships.filter((m) => m.role === 'owner')
    const candidates = owners.length > 0 ? owners : memberships

    candidates.sort((a, b) => {
      const da = new Date(a.companies.created_at).getTime()
      const db = new Date(b.companies.created_at).getTime()
      return db - da
    })

    const selected = candidates[0]

    return NextResponse.json(
      {
        company_id: selected.company_id,
        company_name: selected.companies.name,
        role: selected.role,
        status: selected.companies.status,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error: any) {
    console.error('[companies/me] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

