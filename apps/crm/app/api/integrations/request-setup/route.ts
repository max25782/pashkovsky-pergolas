/**
 * Integration Management API - Request Setup
 * POST /api/integrations/request-setup
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import crypto from 'crypto'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { checkIntegrationAccess } from '@/lib/middleware/integration-access'
import type { RequestSetupDTO } from '@/types/integration'

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

// Validation schema
const RequestSetupSchema = z.object({
  website_url: z.string().url('Valid website URL required'),
  form_plugin: z.string().optional(),
  notes: z.string().optional(),
  payment_method: z.enum(['bit', 'paybox', 'bank'], {
    errorMap: () => ({ message: 'Payment method must be bit, paybox, or bank' }),
  }),
})

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

    // Check if company has access to integrations (paid plans only)
    const hasAccess = await checkIntegrationAccess(companyId)
    if (!hasAccess) {
      return NextResponse.json(
        {
          error: 'Integration not available',
          message: 'Website integration is available on paid plans only',
          upgrade_required: true,
        },
        { status: 403 }
      )
    }

    // Parse and validate body
    const body = await request.json()
    const validationResult = RequestSetupSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      )
    }

    const data: RequestSetupDTO = validationResult.data

    // Check if integration already exists
    const { data: existingIntegration } = await supabase
      .from('company_integrations')
      .select('id, status, webhook_secret')
      .eq('company_id', companyId)
      .single()

    let webhookSecret: string
    let integrationId: string

    if (existingIntegration) {
      // Update existing integration
      webhookSecret = existingIntegration.webhook_secret
      integrationId = existingIntegration.id

      const { error: updateError } = await supabase
        .from('company_integrations')
        .update({
          status: 'pending_payment',
          website_url: data.website_url,
          type: 'webhook',
          updated_at: new Date().toISOString(),
        })
        .eq('id', integrationId)

      if (updateError) {
        throw updateError
      }
    } else {
      // Create new integration
      webhookSecret = crypto.randomBytes(32).toString('hex')

      const { data: newIntegration, error: insertError } = await supabase
        .from('company_integrations')
        .insert({
          company_id: companyId,
          status: 'pending_payment',
          type: 'webhook',
          website_url: data.website_url,
          webhook_secret: webhookSecret,
        })
        .select('id')
        .single()

      if (insertError || !newIntegration) {
        throw insertError || new Error('Failed to create integration')
      }

      integrationId = newIntegration.id
    }

    // Log integration event
    await supabase.from('integration_events').insert({
      company_id: companyId,
      integration_id: integrationId,
      event_type: 'setup_requested',
      payload: {
        website_url: data.website_url,
        form_plugin: data.form_plugin,
        payment_method: data.payment_method,
        notes: data.notes,
        requested_by: userId,
      },
    })

    // Fetch payment instructions
    const paymentInstructions = {
      bit_phone: process.env.PAYMENT_BIT_PHONE || '',
      paybox_link: process.env.PAYMENT_PAYBOX_LINK || '',
      bank_details: {
        bank_name: process.env.PAYMENT_BANK_NAME || '',
        account_number: process.env.PAYMENT_BANK_ACCOUNT || '',
        branch: process.env.PAYMENT_BANK_BRANCH || '',
      },
      payment_note_template: process.env.PAYMENT_NOTE_TEMPLATE || 'Write your company name in the transfer note',
    }

    console.log('[Integration] Setup requested', {
      company_id: companyId,
      integration_id: integrationId,
      payment_method: data.payment_method,
    })

    return NextResponse.json(
      {
        success: true,
        integration_status: 'pending_payment',
        payment_instructions: paymentInstructions,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[Integration API] POST error:', error)

    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

