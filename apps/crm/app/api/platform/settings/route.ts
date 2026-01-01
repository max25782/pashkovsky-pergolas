/**
 * Platform Settings API
 * GET: Retrieve platform settings
 * PUT: Update platform settings
 * Only accessible by SuperAdmin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session/redis-client'
import type { PlatformSettings, PlatformSettingsUpdate } from '@/types/platform-settings'

export const dynamic = 'force-dynamic'

async function checkSuperAdminAuth(request: NextRequest) {
  const sessionId = request.cookies.get('superadmin_session')?.value
  if (!sessionId) return null
  
  const session = await getSession(sessionId)
  if (!session || session.role !== 'superadmin') return null
  
  return session
}

export async function GET(request: NextRequest) {
  try {
    const session = await checkSuperAdminAuth(request)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data, error } = await supabase
      .from('platform_settings')
      .select('*')
      .single<PlatformSettings>()

    if (error) {
      console.error('[Platform Settings GET] Error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[Platform Settings GET] Exception:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await checkSuperAdminAuth(request)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body: PlatformSettingsUpdate = await request.json()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Validate data
    if (body.trial_days !== undefined && (body.trial_days < 0 || body.trial_days > 90)) {
      return NextResponse.json(
        { error: 'Trial days must be between 0 and 90' },
        { status: 400 }
      )
    }

    if (body.vat_percent !== undefined && (body.vat_percent < 0 || body.vat_percent > 100)) {
      return NextResponse.json(
        { error: 'VAT percent must be between 0 and 100' },
        { status: 400 }
      )
    }

    if (body.ai_daily_limit !== undefined && body.ai_daily_limit < 1) {
      return NextResponse.json(
        { error: 'AI daily limit must be at least 1' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('platform_settings')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
        updated_by: session.user_id,
      })
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .select()
      .single<PlatformSettings>()

    if (error) {
      console.error('[Platform Settings PUT] Error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Log the settings update
    await supabase.from('platform_audit_logs').insert({
      event_type: 'settings_updated',
      actor_admin_id: session.user_id,
      payload: {
        changes: Object.keys(body),
        timestamp: new Date().toISOString(),
      },
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('[Platform Settings PUT] Exception:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

