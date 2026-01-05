/**
 * SuperAdmin API - Send Magic Link
 * Allows SuperAdmin to send magic login link to users
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

interface RequestBody {
  email: string
  redirectTo?: string
}

export async function POST(request: NextRequest) {
  try {
    // TODO: Add SuperAdmin auth check here
    // const session = await checkSuperAdminAuth(request)
    // if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: RequestBody = await request.json()
    const { email, redirectTo } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    console.log('[SendMagicLink] Generating magic link for:', email)
    console.log('[SendMagicLink] Redirect URL:', redirectTo)

    // Generate magic link
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: redirectTo || `${request.nextUrl.origin}/app/admin`,
      },
    })

    if (error || !data) {
      console.error('[SendMagicLink] Error:', error)
      return NextResponse.json(
        { error: error?.message || 'Failed to generate magic link' },
        { status: 500 }
      )
    }

    console.log('[SendMagicLink] Magic link generated successfully')

    return NextResponse.json({
      success: true,
      message: `Magic link sent to ${email}`,
      magicLink: data.properties.action_link,
    })
  } catch (error: any) {
    console.error('[SendMagicLink] Exception:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

