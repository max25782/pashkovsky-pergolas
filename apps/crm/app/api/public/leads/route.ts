import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { PublicLeadSchema } from '@/lib/validation/public-lead'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { sendWhatsAppTemplate } from '@/lib/whatsapp-send'
import { uploadLeadConversion } from '@/lib/googleAds/offlineConversion'

function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { db: { schema: 'public' } })
}

export const dynamic = 'force-dynamic'

// CORS headers for cross-origin requests
// Allow requests from production site and localhost for development
const getAllowedOrigin = (origin: string | null): string => {
  if (!origin) {
    return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  }
  
  // Production domains
  if (origin === 'https://www.pashkovsky-group.com' || origin === 'https://pashkovsky-group.com') {
    return origin
  }
  
  // Localhost for development
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
    return origin
  }
  
  // Fallback to environment variable or default
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': getAllowedOrigin(origin),
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-site-token',
  'Access-Control-Max-Age': '86400', // 24 hours
})

// Helper to create response with CORS headers
function jsonResponse(data: any, init?: ResponseInit, request?: NextRequest | null) {
  const origin = request?.headers.get('origin') || null
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...corsHeaders(origin),
      ...init?.headers,
    },
  })
}

// Rate limit: 5 requests per 15 minutes per IP
const RATE_LIMIT_CONFIG = {
  maxRequests: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  return jsonResponse({}, { status: 200 }, request)
}

/**
 * Public Lead Submission Endpoint
 * 
 * Security:
 * - Site token validation (x-site-token)
 * - Rate limiting (IP-based)
 * - Honeypot field (website)
 * - Zod validation
 * 
 * Usage:
 * POST https://crm.pashkovsky-group.com/api/public/leads
 * Headers: x-site-token: <CRM_SITE_TOKEN>
 * Body: { name, phone, email?, message?, ... }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // 1. Check site token
    const siteToken = request.headers.get('x-site-token')
    const expectedToken = process.env.CRM_SITE_TOKEN

    if (!expectedToken) {
      console.error('[Public Leads] CRM_SITE_TOKEN not configured')
      return jsonResponse(
        { error: 'Service misconfigured' },
        { status: 500 },
        request
      )
    }

    if (!siteToken || siteToken !== expectedToken) {
      console.warn('[Public Leads] Invalid site token')
      return jsonResponse(
        { error: 'Unauthorized' },
        { status: 401 },
        request
      )
    }

    // 2. Rate limiting
    const clientIp = getClientIp(request)
    const rateLimitResult = checkRateLimit(
      `lead:${clientIp}`,
      RATE_LIMIT_CONFIG
    )

    if (!rateLimitResult.allowed) {
      console.warn('[Public Leads] Rate limit exceeded', {
        ip: clientIp,
        resetAt: new Date(rateLimitResult.resetAt).toISOString(),
      })
      return jsonResponse(
        { 
          error: 'Too many requests',
          retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          }
        },
        request
      )
    }

    // 3. Parse and validate body
    const body = await request.json()
    
    // 4. Honeypot check (if 'website' field is filled, it's a bot)
    if (body.website && body.website.trim() !== '') {
      console.warn('[Public Leads] Honeypot triggered', {
        ip: clientIp,
        source: body.source,
      })
      // Return success to not alert the bot
      return jsonResponse({ success: true, id: 'blocked' }, undefined, request)
    }

    // 5. Validate with Zod
    const validationResult = PublicLeadSchema.safeParse(body)
    
    if (!validationResult.success) {
      console.warn('[Public Leads] Validation failed', {
        ip: clientIp,
        errors: validationResult.error.issues.map(i => i.message),
      })
      return jsonResponse(
        { 
          error: 'Invalid data',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          }))
        },
        { status: 400 },
        request
      )
    }

    const leadData = validationResult.data

    // 6. Get default company ID and Supabase client
    const defaultCompanyId = process.env.DEFAULT_COMPANY_ID
    const supabase = getSupabase()

    if (!defaultCompanyId) {
      console.error('[Public Leads] DEFAULT_COMPANY_ID not configured')
      return jsonResponse(
        { error: 'Service misconfigured' },
        { status: 500 },
        request
      )
    }
    if (!supabase) {
      console.error('[Public Leads] Supabase not configured (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)')
      return jsonResponse(
        { error: 'Service misconfigured' },
        { status: 500 },
        request
      )
    }

    // 7. Save to database
    const { data: lead, error: dbError } = await supabase
      .from('leads')
      .insert({
        company_id: defaultCompanyId,
        name: leadData.name,
        phone: leadData.phone,
        email: leadData.email || null,
        message: leadData.message || null,
        source: leadData.source || 'website',
        status: 'waiting',
        utm_source: leadData.utm_source || null,
        utm_medium: leadData.utm_medium || null,
        utm_campaign: leadData.utm_campaign || null,
        metadata: leadData.metadata || null,
        gclid: leadData.gclid || null,
        google_conv_sent: false,
      })
      .select('id, gclid, google_conv_sent')
      .single()

    if (dbError) {
      console.error('[Public Leads] Database error', {
        code: dbError.code,
        message: dbError.message,
      })
      return jsonResponse(
        { error: 'Failed to save lead' },
        { status: 500 },
        request
      )
    }

    // 8. Success
    const duration = Date.now() - startTime

    // 9. Send WhatsApp welcome message (fire-and-forget)
    const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'hi'
    sendWhatsAppTemplate(leadData.phone, templateName, [leadData.name])
      .then((r) => {
        if (!r.ok) console.warn('[Public Leads] WhatsApp send failed:', r.error)
      })
      .catch((e) => console.warn('[Public Leads] WhatsApp send error:', e))

    // 10. Google Ads offline conversion (fire-and-forget, never block lead creation)
    if (leadData.gclid) {
      uploadLeadConversion(leadData.gclid, 1)
        .then(async () => {
          await supabase
            .from('leads')
            .update({
              google_conv_sent: true,
              google_conv_sent_at: new Date().toISOString(),
            })
            .eq('id', lead.id)
        })
        .catch((e) => {
          console.error('[Public Leads] Google Ads conversion failed:', e?.message ?? e)
        })
    }

    return jsonResponse(
      { 
        success: true,
        id: lead.id,
      },
      { 
        status: 201,
        headers: {
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.resetAt),
        }
      },
      request
    )

  } catch (error) {
    const duration = Date.now() - startTime
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Public Leads] Unexpected error', {
      error: message,
      duration: `${duration}ms`,
    })
    
    return jsonResponse(
      { error: 'Internal server error' },
      { status: 500 },
      request
    )
  }
}

// Health check
export async function GET(request: NextRequest) {
  return jsonResponse({
    service: 'public-leads',
    status: 'ok',
    rateLimit: RATE_LIMIT_CONFIG,
  }, undefined, request)
}

