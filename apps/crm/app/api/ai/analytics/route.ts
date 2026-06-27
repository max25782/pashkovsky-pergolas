/**
 * AI Analytics API Route
 * 
 * POST /api/ai/analytics
 * 
 * Analyzes CRM data using AI based on analytics context
 */

import { NextRequest, NextResponse } from 'next/server'
import { buildAnalyticsContext } from '@/lib/ai/buildAnalyticsContext'
import { selectSystemPrompt } from '@/lib/ai/prompts'
import { callLLM } from '@/lib/ai/client'
import type { AnalyticsContext } from '@/lib/ai/analyticsTypes'
import { requireAuthAsync } from '@/lib/middleware/auth-async'

// ============================================================================
// Rate Limiting
// ============================================================================

// Simple in-memory rate limit (can be improved with Redis/DB)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 30 // requests per hour

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const record = rateLimitMap.get(identifier)

  if (!record || now > record.resetAt) {
    // Reset or create new record
    rateLimitMap.set(identifier, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    })
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 }
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 }
  }

  // Increment count
  record.count++
  rateLimitMap.set(identifier, record)
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count }
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetAt) {
      rateLimitMap.delete(key)
    }
  }
}, RATE_LIMIT_WINDOW_MS)

// ============================================================================
// Request/Response Types
// ============================================================================

interface AnalyticsRequest {
  mode: 'leads' | 'deals' | 'finance' | 'manager'
  period: {
    from: string // YYYY-MM-DD
    to: string // YYYY-MM-DD
  }
  question: string
  companyId?: string
}

interface AISuggestion {
  type: 'mark_stale' | 'follow_up'
  dealIds?: string[]
  leadIds?: string[]
  reason: string
}

interface AnalyticsResponse {
  answer: string
  context: AnalyticsContext
  suggestions?: AISuggestion[]
}

// ============================================================================
// API Handler
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    // 1. Check auth
    const authCheck = await requireAuthAsync(req)
    if (!authCheck.authorized) return authCheck.error

    // 2. Get rate limit identifier (use IP or token hash)
    const identifier = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                      req.headers.get('x-real-ip') || 
                      'unknown'
    
    const rateLimit = checkRateLimit(identifier)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    // 3. Parse and validate request body
    let body: AnalyticsRequest
    try {
      body = await req.json()
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!body.mode || !body.period || !body.question) {
      return NextResponse.json(
        { error: 'Missing required fields: mode, period, question' },
        { status: 400 }
      )
    }

    if (!['leads', 'deals', 'finance', 'manager'].includes(body.mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be: leads, deals, finance, or manager' },
        { status: 400 }
      )
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(body.period.from) || !dateRegex.test(body.period.to)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      )
    }

    // Validate question length
    if (body.question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question cannot be empty' },
        { status: 400 }
      )
    }

    if (body.question.length > 1000) {
      return NextResponse.json(
        { error: 'Question too long. Maximum 1000 characters.' },
        { status: 400 }
      )
    }

    // 4. Build analytics context (use company from auth if not provided)
    const companyId = body.companyId || authCheck.context?.companyId
    
    let context: AnalyticsContext
    try {
      context = await buildAnalyticsContext({
        mode: body.mode,
        period: {
          from: body.period.from,
          to: body.period.to,
          tz: 'Asia/Jerusalem',
        },
        companyId,
      })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('[AI Analytics] Error building context:', {
        error: msg?.substring(0, 500), // Limit log size
        mode: body.mode,
      })
      return NextResponse.json(
        { error: 'Failed to build analytics context' },
        { status: 500 }
      )
    }

    // 5. Get system prompt
    const systemPrompt = selectSystemPrompt(body.mode)

    // 6. Prepare context JSON (compact, no sensitive data)
    const contextJson = JSON.stringify(context, null, 0) // Compact JSON

    // 7. Call LLM
    const llmResponse = await callLLM({
      systemPrompt,
      userMessage: body.question.trim(),
      contextData: contextJson,
      temperature: 0.7,
      maxTokens: 2000,
    })

    if (llmResponse.error) {
      console.error('[AI Analytics] LLM error:', {
        error: llmResponse.error.substring(0, 500), // Limit log size
        mode: body.mode,
      })
      return NextResponse.json(
        { error: 'Failed to get AI response' },
        { status: 500 }
      )
    }

    // Parse suggestions from AI response (if mode is deals)
    let suggestions: AISuggestion[] | undefined
    if (body.mode === 'deals') {
      try {
        const suggestionsMatch = llmResponse.content.match(/SUGGESTIONS:\s*(\[[\s\S]*?\])/i)
        if (suggestionsMatch) {
          const suggestionsJson = suggestionsMatch[1]
          suggestions = JSON.parse(suggestionsJson)
          
          // Validate suggestions structure
          if (Array.isArray(suggestions)) {
            suggestions = suggestions.filter((s: any) => {
              return s.type && 
                     (s.type === 'mark_stale' || s.type === 'follow_up') &&
                     s.reason &&
                     ((s.type === 'mark_stale' && Array.isArray(s.dealIds)) ||
                      (s.type === 'follow_up' && Array.isArray(s.leadIds)))
            })
            
            // Remove suggestions block from answer
            llmResponse.content = llmResponse.content.replace(/SUGGESTIONS:[\s\S]*$/i, '').trim()
          } else {
            suggestions = undefined
          }
        }
      } catch (error: unknown) {
        // If parsing fails, just ignore suggestions
        const msg = error instanceof Error ? error.message : String(error)
        console.warn('[AI Analytics] Failed to parse suggestions:', msg?.substring(0, 200))
        suggestions = undefined
      }
    }

    // 8. Return response
    const response: AnalyticsResponse = {
      answer: llmResponse.content,
      context, // Return context for reference
      suggestions, // Include suggestions if parsed
    }

    return NextResponse.json(response, {
      headers: {
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[AI Analytics] Unexpected error:', {
      error: msg?.substring(0, 500), // Limit log size
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

