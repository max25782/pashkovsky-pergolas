import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PublicLeadSchema } from '@/lib/validation/public-lead'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-site-token',
  'Access-Control-Max-Age': '86400', // 24 hours
}

// Helper to create response with CORS headers
function jsonResponse(data: any, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...corsHeaders,
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
  return jsonResponse({}, { status: 200 })
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
        { status: 500 }
      )
    }

    if (!siteToken || siteToken !== expectedToken) {
      console.warn('[Public Leads] Invalid site token')
      return jsonResponse(
        { error: 'Unauthorized' },
        { status: 401 }
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
        }
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
      return jsonResponse({ success: true, id: 'blocked' })
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
        { status: 400 }
      )
    }

    const leadData = validationResult.data

    // 6. Get default company ID for website leads
    const defaultCompanyId = process.env.DEFAULT_COMPANY_ID
    
    if (!defaultCompanyId) {
      console.error('[Public Leads] DEFAULT_COMPANY_ID not configured')
      return jsonResponse(
        { error: 'Service misconfigured' },
        { status: 500 }
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
        status: 'pending',
        utm_source: leadData.utm_source || null,
        utm_medium: leadData.utm_medium || null,
        utm_campaign: leadData.utm_campaign || null,
        metadata: leadData.metadata || null,
      })
      .select('id')
      .single()

    if (dbError) {
      console.error('[Public Leads] Database error', {
        code: dbError.code,
        message: dbError.message,
      })
      return jsonResponse(
        { error: 'Failed to save lead' },
        { status: 500 }
      )
    }

    // 8. Success
    const duration = Date.now() - startTime
    console.log('[Public Leads] Success', {
      leadId: lead.id,
      source: leadData.source,
      hasEmail: !!leadData.email,
      hasMessage: !!leadData.message,
      hasUtm: !!(leadData.utm_source || leadData.utm_medium || leadData.utm_campaign),
      ip: clientIp,
      duration: `${duration}ms`,
    })

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
      }
    )

  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error('[Public Leads] Unexpected error', {
      error: error.message,
      duration: `${duration}ms`,
    })
    
    return jsonResponse(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Health check
export async function GET() {
  return jsonResponse({
    service: 'public-leads',
    status: 'ok',
    rateLimit: RATE_LIMIT_CONFIG,
  })
}

