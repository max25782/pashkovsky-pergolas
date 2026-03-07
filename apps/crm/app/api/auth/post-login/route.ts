import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

interface PostLoginRequest {
  user_id: string
}

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body: PostLoginRequest = await req.json()
    const { user_id } = body

    // Verify user_id matches authenticated user
    if (user_id !== user.id) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      )
    }


    // Call PostgreSQL function to ensure trial (idempotent)
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )

    const { data, error } = await serviceClient.rpc('ensure_company_trial', {
      p_user_id: user_id,
    })

    if (error) {
      console.error('[PostLogin] Error ensuring trial:', error)
      // Don't fail the login if trial creation fails
      return NextResponse.json({
        ok: true,
        trial_ensured: false,
        error: error.message,
      })
    }


    return NextResponse.json({
      ok: true,
      trial_ensured: true,
      company_id: data,
    })
  } catch (error: unknown) {
    console.error('[PostLogin] Unexpected error:', error)
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : String(error)) || 'Internal server error' },
      { status: 500 }
    )
  }
}




