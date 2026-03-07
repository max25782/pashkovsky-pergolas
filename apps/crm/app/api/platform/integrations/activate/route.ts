/**
 * SuperAdmin API - Activate Integration
 * POST /api/platform/integrations/activate
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { requireSuperAdmin } from '@/lib/middleware/superadmin-auth'
import { logPlatformEvent } from '@/lib/audit/platform-logs'

export const dynamic = 'force-dynamic'

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

const ActivateSchema = z.object({
  company_id: z.string().uuid(),
})

/**
 * POST - Activate integration (mark as paid)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify SuperAdmin
    const admin = await requireSuperAdmin(request)

    // Parse body
    const body = await request.json()
    const validationResult = ActivateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
    }

    const { company_id } = validationResult.data

    // Get integration
    const { data: integration, error: fetchError } = await supabase
      .from('company_integrations')
      .select('id')
      .eq('company_id', company_id)
      .single()

    if (fetchError || !integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      )
    }

    // Update status to active
    const { error: updateError } = await supabase
      .from('company_integrations')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id)

    if (updateError) {
      throw updateError
    }

    // Log integration event
    await supabase.from('integration_events').insert({
      company_id,
      integration_id: integration.id,
      event_type: 'activated',
      payload: {
        activated_by: admin.user_id,
      },
    })

    // Log platform audit
    await logPlatformEvent({
      event_type: 'integration_activated',
      company_id,
      actor_admin_id: admin.user_id,
      payload: {
        integration_id: integration.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[Platform API] Activate error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    if (msg?.includes('Unauthorized') || msg?.includes('Forbidden')) {
      return NextResponse.json(
        { error: msg },
        { status: msg.includes('Unauthorized') ? 401 : 403 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

