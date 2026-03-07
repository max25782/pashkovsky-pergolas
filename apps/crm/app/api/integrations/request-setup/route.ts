/**
 * Request Integration Setup
 * POST /api/integrations/request-setup
 * Allows companies to request website integration setup
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { createClient } from '@supabase/supabase-js'
import { RequestSetupDTO } from '@/types/integration'
import { logPlatformEvent } from '@/lib/audit/platform-logs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null

/**
 * POST - Request integration setup
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await requireAuthAsync(request)
    if (!authResult.authorized) {
      return authResult.error
    }

    const companyId = authResult.context.companyId
    const userId = authResult.user.id

    if (!companyId) {
      return NextResponse.json(
        { error: 'No company found for user' },
        { status: 404 }
      )
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Server not configured' },
        { status: 500 }
      )
    }

    // Parse request body
    const body: RequestSetupDTO = await request.json()

    // Validate required fields
    if (!body.website_url || !body.payment_method) {
      return NextResponse.json(
        { error: 'website_url and payment_method are required' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(body.website_url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid website URL format' },
        { status: 400 }
      )
    }

    // Check if integration already exists
    const { data: existingIntegration } = await supabase
      .from('company_integrations')
      .select('id, status')
      .eq('company_id', companyId)
      .single()

    if (existingIntegration) {
      return NextResponse.json(
        { 
          error: 'Integration already exists',
          integration_id: existingIntegration.id,
          status: existingIntegration.status,
        },
        { status: 409 }
      )
    }

    // Create integration request (status: pending_payment)
    const { data: integration, error: integrationError } = await supabase
      .from('company_integrations')
      .insert({
        company_id: companyId,
        type: 'webhook',
        status: 'pending_payment',
        website_url: body.website_url,
        webhook_secret: '', // Will be generated when activated
      })
      .select()
      .single()

    if (integrationError || !integration) {
      console.error('[Integration Request] Failed to create integration:', integrationError)
      return NextResponse.json(
        { error: 'Failed to create integration request' },
        { status: 500 }
      )
    }

    // Log integration event
    await supabase.from('integration_events').insert({
      company_id: companyId,
      integration_id: integration.id,
      event_type: 'setup_requested',
      payload: {
        website_url: body.website_url,
        form_plugin: body.form_plugin,
        notes: body.notes,
        payment_method: body.payment_method,
      },
    })

    // Log platform event
    await logPlatformEvent({
      event_type: 'integration_setup_requested',
      company_id: companyId,
      actor_user_id: userId,
      payload: {
        integration_id: integration.id,
        website_url: body.website_url,
        payment_method: body.payment_method,
      },
    })

    return NextResponse.json({
      success: true,
      integration: {
        id: integration.id,
        status: integration.status,
        website_url: integration.website_url,
      },
      message: 'Integration setup request submitted successfully',
    })
  } catch (error: unknown) {
    console.error('[Integration Request] Error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    if (msg?.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: msg || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'
