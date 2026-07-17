/**
 * AI Offer Text Improvement API
 *
 * POST /api/ai/improve-offer-text
 * Body: {
 *   text: string,
 *   outputLanguage?: 'en' | 'ru' | 'sr' | 'he'   // default 'he' if omitted
 *   context?: { customerName?, pergolaType?, price? }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildOfferImprovementSystemPrompt } from '@/lib/ai/offer-improvement-prompt'
import {
  parseOfferAiOutputLanguage,
  type OfferAiOutputLanguage,
} from '@/lib/ai/offer-text-output-languages'
import { aiImproveLimiter, checkLimit } from '@/lib/middleware/rate-limit'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null

interface ImproveTextRequest {
  text: string
  outputLanguage?: string
  context?: {
    customerName?: string
    pergolaType?: string
    price?: number
  }
}

function formatContextForModel(context?: ImproveTextRequest['context']): string {
  if (!context) return ''
  let s = ''
  if (context.customerName) s += `Customer: ${context.customerName}\n`
  if (context.pergolaType) s += `Product type: ${context.pergolaType}\n`
  if (context.price !== undefined && context.price !== null) {
    s += `Price: ${context.price} ILS\n`
  }
  return s
}

async function improveTextWithGemini(
  text: string,
  context: ImproveTextRequest['context'] | undefined,
  outputLanguage: OfferAiOutputLanguage,
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured')
  }

  const systemPrompt = buildOfferImprovementSystemPrompt(outputLanguage)
  const contextStr = formatContextForModel(context)
  const userMessage = contextStr
    ? `${contextStr}\n\nOffer specifications:\n${text}`
    : `Offer specifications:\n${text}`

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: systemPrompt }],
        },
        {
          role: 'user',
          parts: [{ text: userMessage }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1500,
      },
    }),
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Offer AI] Gemini API error:', errorText)
    throw new Error(`Gemini API error: ${response.status}`)
  }
  
  const data = await response.json()
  const improvedText = data.candidates?.[0]?.content?.parts?.[0]?.text || text
  
  return improvedText.trim()
}

// Authentication helper
async function authenticateRequest(request: NextRequest): Promise<{ userId: string; companyId: string } | null> {
  const authHeader = request.headers.get('authorization')
  const adminToken = request.headers.get('x-admin-token')
  
  
  // If JWT token
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    
    if (!supabase) {
      console.error('[AI Auth] Supabase client not available')
      return null
    }
    
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error) {
      console.error('[AI Auth] getUser error:', error.message)
      return null
    }
    if (!user) {
      console.error('[AI Auth] No user found')
      return null
    }
    
    
    // Get company from company_members
    const { data: member, error: memberError } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .single()
    
    if (memberError) {
      console.error('[AI Auth] company_members query error:', memberError.message)
    }
    
    if (!member) {
      console.error('[AI Auth] User not in any company')
      return null
    }
    
    return { userId: user.id, companyId: member.company_id }
  }
  
  // If admin token (legacy, but accepted)
  if (adminToken) {
    // For admin tokens, use default company
    const defaultCompanyId = process.env.DEFAULT_COMPANY_ID
    if (!defaultCompanyId) return null
    
    return { userId: 'admin', companyId: defaultCompanyId }
  }
  
  console.error('[AI Auth] No auth method found')
  return null
}

export async function POST(request: NextRequest) {
  try {
    
    // 1. Authenticate
    const auth = await authenticateRequest(request)
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // 2. Rate limit — 30 improvements per company per day
    const rl = await checkLimit(aiImproveLimiter, `company:${auth.companyId}`)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Daily AI improvement limit reached. Try again tomorrow.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
      )
    }

    // 3. Parse request
    const body: ImproveTextRequest = await request.json()
    const { text, context } = body
    const outputLanguage = parseOfferAiOutputLanguage(body.outputLanguage)
    
    
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }
    
    if (text.length > 6000) {
      return NextResponse.json({ error: 'Text too long (max 6000 characters)' }, { status: 400 })
    }
    
    // 4. Check API key
    if (!GEMINI_API_KEY) {
      console.error('[AI Improve] GEMINI_API_KEY not configured!')
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 })
    }
    
    
    // 5. Improve text with AI
    const improvedText = await improveTextWithGemini(text, context, outputLanguage)
    
    // 6. Log the improvement (optional, for analytics)
    if (supabase) {
      try {
        await supabase.from('ai_text_improvements').insert({
          company_id: auth.companyId,
          user_id: auth.userId,
          original_text: text,
          improved_text: improvedText,
          context: { ...context, outputLanguage },
        })
      } catch (err: unknown) {
        // Ignore if table doesn't exist
        console.warn('[Offer AI] Failed to log improvement:', err instanceof Error ? err.message : String(err))
      }
    }
    
    return NextResponse.json({
      originalText: text,
      improvedText,
      improvements: {
        lengthBefore: text.length,
        lengthAfter: improvedText.length,
        improved: text !== improvedText,
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Offer AI] Unhandled error:', msg)
    return NextResponse.json({ error: 'AI service temporarily unavailable' }, { status: 500 })
  }
}

// GET endpoint to check service status
export async function GET() {
  return NextResponse.json({
    service: 'AI Offer Text Improvement',
    status: GEMINI_API_KEY ? 'available' : 'unavailable',
    model: 'gemini-2.5-flash',
  })
}

