import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    const cookies = req.cookies.getAll()
    const cookieNames = cookies.map((c) => c.name)
    const hasAuthCookies = cookieNames.some((name) => name.startsWith('sb-'))

    return NextResponse.json({
      authenticated: !!user && !authError,
      user_id: user?.id || null,
      email: user?.email || null,
      has_cookies: hasAuthCookies,
      cookie_count: cookies.length,
      cookie_names: cookieNames,
      auth_error: authError?.message || null,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        authenticated: false,
        error: error.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
