/**
 * SuperAdmin API - Rotate Webhook Secret
 * POST /api/platform/integrations/rotate-secret
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import crypto from 'crypto'
import { requireSuperAdmin } from '@/lib/middleware/superadmin-auth'
import { logPlatformEvent } from '@/lib/audit/platform-logs'

export const runtime = 'nodejs'
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

const RotateSchema = z.object({
  company_id: z.string().uuid(),
})

/**
 * POST - Rotate webhook secret
 */
export async function POST(request: NextRequest) {
  try {
    // Verify SuperAdmin
    const admin = await requireSuperAdmin(request)

    // Parse body
    const body = await request.json()
    const validationResult = RotateSchema.safeParse(body)

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
      .select('id, webhook_secret')
      .eq('company_id', company_id)
      .single()

    if (fetchError || !integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      )
    }

    const oldSecret = integration.webhook_secret

    // Generate new secret
    const newSecret = crypto.randomBytes(32).toString('hex')

    // Update secret
    const { error: updateError } = await supabase
      .from('company_integrations')
      .update({
        webhook_secret: newSecret,
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id)

    if (updateError) {
      throw updateError
    }

    // Log platform audit
    await logPlatformEvent({
      event_type: 'integration_secret_rotated',
      company_id,
      actor_admin_id: admin.user_id,
      payload: {
        integration_id: integration.id,
        old_secret_prefix: oldSecret.substring(0, 8),
        new_secret_prefix: newSecret.substring(0, 8),
      },
    })

    console.log('[Platform] Webhook secret rotated', {
      company_id,
      integration_id: integration.id,
      admin_id: admin.user_id,
    })

    return NextResponse.json({ 
      success: true,
      new_secret: newSecret,
    })
  } catch (error: any) {
    console.error('[Platform API] Rotate secret error:', error)

    if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message.includes('Unauthorized') ? 401 : 403 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

