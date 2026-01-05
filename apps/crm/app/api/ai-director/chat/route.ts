/**
 * AI Director Chat API
 * Handles chat requests to the AI Director (Bedrock Agent)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { checkAIDirectorAccess } from '@/lib/middleware/ai-director-subscription'
import { callBedrockAgent } from '@/lib/ai/bedrock-client'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY)
  : null

/**
 * Call Bedrock via Lambda proxy (if configured)
 */
async function callBedrockAgentViaLambda(params: {
  url: string
  secret?: string
  prompt: string
  sessionId: string
  sessionAttributes: Record<string, string>
}): Promise<{ content: string; sessionId?: string; error?: string }> {
  const response = await fetch(params.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ai-director-secret': params.secret || '',
    },
    body: JSON.stringify({
      prompt: params.prompt,
      sessionId: params.sessionId,
      sessionAttributes: params.sessionAttributes,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    return {
      content: '',
      error: errorData.error || `Lambda invocation failed with status ${response.status}`,
    }
  }

  const json = await response.json()
  return {
    content: json.content || json.response || '',
    sessionId: json?.sessionId,
    error: json?.error,
  }
}

/**
 * Detect language from message content
 */
function detectLanguage(message: string): string {
  // Hebrew characters
  if (/[\u0590-\u05FF]/.test(message)) {
    return 'he'
  }
  
  // Russian/Cyrillic characters
  if (/[\u0400-\u04FF]/.test(message)) {
    return 'ru'
  }
  
  // Default to English
  return 'en'
}

/**
 * Get or create AI Director session
 */
async function getOrCreateDirectorSession(companyId: string, sessionId?: string): Promise<{ id: string }> {
  if (!supabase) {
    throw new Error('Supabase not configured')
  }

  if (sessionId) {
    const { data: existing } = await supabase
      .from('ai_director_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('company_id', companyId)
      .single()

    if (existing) {
      return { id: existing.id }
    }
  }

  const { data: newSession, error } = await supabase
    .from('ai_director_sessions')
    .insert({
      company_id: companyId,
    })
    .select('id')
    .single()

  if (error || !newSession) {
    throw new Error(`Failed to create session: ${error?.message}`)
  }

  return { id: newSession.id }
}

/**
 * Save message to database
 */
async function saveMessage(sessionId: string, role: 'user' | 'assistant', content: string) {
  if (!supabase) return

  await supabase.from('ai_director_messages').insert({
    session_id: sessionId,
    role,
    content,
  })
}

/**
 * Preflight check for external data API
 */
async function preflightExternalDataApi(apiBaseUrl: string): Promise<NextResponse | null> {
  try {
    const healthUrl = `${apiBaseUrl}/api/ai-director/data/deals?company_id=test&limit=1`
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        'x-api-token': process.env.AI_DIRECTOR_API_TOKEN || '',
      },
    })

    if (!response.ok && response.status !== 400) {
      return NextResponse.json({
        error: 'External data API недоступен',
        hint: `Проверьте, что API доступен по адресу: ${apiBaseUrl}`,
        checkedUrl: healthUrl,
      }, { status: 503 })
    }

    return null
  } catch (error: any) {
    return NextResponse.json({
      error: 'Не удалось подключиться к внешнему API',
      hint: `Проверьте настройки NEXT_PUBLIC_APP_URL: ${apiBaseUrl}`,
    }, { status: 503 })
  }
}

/**
 * POST /api/ai-director/chat
 * 
 * Send message to AI Director (Bedrock Agent)
 * Body: { message: string, sessionId?: string }
 */
export async function POST(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error
  
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }
  
  try {
    const { message, sessionId, language } = await req.json()
    const companyId = authCheck.context?.companyId
    
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
    }

    // Check subscription access (AI Director only for Pro/Enterprise)
    const accessCheck = await checkAIDirectorAccess(companyId)
    if (accessCheck) return accessCheck
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }
    
    // Detect language from message if not provided
    const detectedLanguage = language || detectLanguage(message)
    
    // Get or create session
    const session = await getOrCreateDirectorSession(companyId, sessionId)
    
    // Save user message
    await saveMessage(session.id, 'user', message)
    
    // Prepare session attributes
    const sessionAttributes = {
      company_id: companyId,
      api_base_url: process.env.NEXT_PUBLIC_APP_URL || '',
      api_token: process.env.AI_DIRECTOR_API_TOKEN || '',
      user_language: detectedLanguage,
    }
    
    console.log('[AI Director] Session attributes:', {
      company_id: sessionAttributes.company_id,
      api_base_url: sessionAttributes.api_base_url,
      api_token: sessionAttributes.api_token ? '***' + sessionAttributes.api_token.slice(-4) : 'MISSING',
      user_language: sessionAttributes.user_language,
    })
    
    if (!sessionAttributes.api_token) {
      console.error('[AI Director] ERROR: AI_DIRECTOR_API_TOKEN is not set in environment variables!')
    }

    const preflightError = await preflightExternalDataApi(sessionAttributes.api_base_url)
    if (preflightError) {
      return preflightError
    }

    // Check if Lambda proxy is configured
    const invokeLambdaUrl = process.env.AI_DIRECTOR_INVOKE_LAMBDA_URL
    const invokeLambdaSecret = process.env.AI_DIRECTOR_INVOKE_LAMBDA_SECRET

    let bedrockResponse: { content: string; sessionId?: string; error?: string }

    if (invokeLambdaUrl && invokeLambdaSecret) {
      // Call intermediate Lambda for Bedrock invocation
      console.log('[AI Director] Invoking Bedrock via Lambda proxy:', invokeLambdaUrl)
      try {
        bedrockResponse = await callBedrockAgentViaLambda({
          url: invokeLambdaUrl,
          secret: invokeLambdaSecret,
          prompt: message,
          sessionId: session.id,
          sessionAttributes,
        })
      } catch (lambdaError: any) {
        console.error('[AI Director] Error invoking Bedrock via Lambda:', lambdaError)
        return NextResponse.json({ error: `Failed to communicate with AI Director service: ${lambdaError.message}` }, { status: 500 })
      }
    } else {
      // Fallback to direct Bedrock SDK invocation
      console.log('[AI Director] Invoking Bedrock directly with SDK')
      bedrockResponse = await callBedrockAgent({
        prompt: message,
        sessionId: session.id,
        sessionAttributes,
      })
    }

    if (bedrockResponse.error) {
      console.error('[AI Director] Bedrock error:', bedrockResponse.error)
      return NextResponse.json({ error: bedrockResponse.error }, { status: 500 })
    }

    // Save AI response
    if (bedrockResponse.content) {
      await saveMessage(session.id, 'assistant', bedrockResponse.content)
    }

    return NextResponse.json({
      response: bedrockResponse.content || '',
      sessionId: bedrockResponse.sessionId || session.id,
    })
  } catch (error: any) {
    console.error('[AI Director] Chat error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'
