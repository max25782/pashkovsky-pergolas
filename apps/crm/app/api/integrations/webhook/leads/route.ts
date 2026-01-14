/**
 * Webhook Endpoint for Lead Reception
 * POST /api/integrations/webhook/leads
 * 
 * Accepts leads from external websites with HMAC-SHA256 signature verification
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { verifySignature, normalizePhoneIL } from '@/lib/middleware/integration-access'
import type { WebhookLeadPayload } from '@/types/integration'

// Force nodejs runtime for crypto
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

// Zod validation schema
const WebhookLeadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(9, 'Phone must be at least 9 digits'),
  email: z.string().email().optional(),
  message: z.string().optional(),
  source_url: z.string().url().optional(),
  utm: z.record(z.string()).optional(),
  extra: z.record(z.any()).optional(),
})

/**
 * POST handler - receive lead from website
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // 1. Get signature from header
    const signature = request.headers.get('x-alumin-signature')
    if (!signature) {
      console.warn('[Webhook] Missing x-alumin-signature header')
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      )
    }

    // 2. Get raw body as text for signature verification
    const bodyText = await request.text()
    let body: any
    try {
      body = JSON.parse(bodyText)
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    // 3. Validate payload structure
    const validationResult = WebhookLeadSchema.safeParse(body)
    if (!validationResult.success) {
      console.warn('[Webhook] Validation failed:', validationResult.error.issues)
      return NextResponse.json(
        {
          error: 'Invalid payload',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      )
    }

    const leadData: WebhookLeadPayload = validationResult.data

    // 4. Find integration by trying signature verification with all active integrations
    // (This is more secure than passing webhook_secret in headers)
    const { data: integrations, error: fetchError } = await supabase
      .from('company_integrations')
      .select('id, company_id, webhook_secret, status')
      .eq('status', 'active')

    if (fetchError || !integrations || integrations.length === 0) {
      console.warn('[Webhook] No active integrations found')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Try to verify signature with each active integration
    let matchedIntegration: typeof integrations[0] | null = null
    for (const integration of integrations) {
      if (verifySignature(bodyText, signature, integration.webhook_secret)) {
        matchedIntegration = integration
        break
      }
    }

    if (!matchedIntegration) {
      console.warn('[Webhook] Signature verification failed')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    const { company_id, id: integration_id } = matchedIntegration

    // 5. Normalize phone number
    const normalizedPhone = normalizePhoneIL(leadData.phone)

    // 6. Check for duplicate (same phone + similar message within 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('id, message')
      .eq('company_id', company_id)
      .eq('phone', normalizedPhone)
      .gte('created_at', oneDayAgo)

    if (existingLeads && existingLeads.length > 0) {
      // Check if message is similar (if both have messages)
      if (leadData.message) {
        const isDuplicate = existingLeads.some(
          lead => lead.message && lead.message.trim() === leadData.message!.trim()
        )
        if (isDuplicate) {
          console.log('[Webhook] Duplicate lead detected (24h window)', {
            company_id,
            phone: normalizedPhone,
          })
          return NextResponse.json(
            { success: true, deduped: true },
            { status: 200 }
          )
        }
      }
    }

    // 7. Insert lead
    const { data: lead, error: insertError } = await supabase
      .from('leads')
      .insert({
        company_id,
        name: leadData.name,
        phone: normalizedPhone,
        email: leadData.email || null,
        message: leadData.message || null,
        source: 'website',
        status: 'pending',
        utm_source: leadData.utm?.utm_source || null,
        utm_medium: leadData.utm?.utm_medium || null,
        utm_campaign: leadData.utm?.utm_campaign || null,
        metadata: {
          source_url: leadData.source_url,
          utm: leadData.utm,
          extra: leadData.extra,
        },
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[Webhook] Database insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to save lead' },
        { status: 500 }
      )
    }

    // 8. Log integration event
    await supabase.from('integration_events').insert({
      company_id,
      integration_id,
      event_type: 'lead_received',
      payload: {
        lead_id: lead.id,
        source_url: leadData.source_url,
        has_email: !!leadData.email,
        has_message: !!leadData.message,
      },
    })

    // 9. Update last_event_at
    await supabase
      .from('company_integrations')
      .update({ last_event_at: new Date().toISOString() })
      .eq('id', integration_id)

    // 10. Success
    const duration = Date.now() - startTime
    console.log('[Webhook] Lead received successfully', {
      lead_id: lead.id,
      company_id,
      duration: `${duration}ms`,
    })

    return NextResponse.json(
      {
        success: true,
        lead_id: lead.id,
      },
      { status: 201 }
    )
  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error('[Webhook] Unexpected error:', {
      error: error.message,
      duration: `${duration}ms`,
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    service: 'webhook-leads',
    status: 'ok',
    version: '1.0',
  })
}




