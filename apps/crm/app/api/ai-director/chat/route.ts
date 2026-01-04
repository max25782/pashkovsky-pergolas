import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { callBedrockAgent } from '@/lib/ai/bedrock-client'
import { checkAIDirectorAccess } from '@/lib/middleware/ai-director-subscription'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY)
  : undefined

async function callBedrockAgentViaLambda(params: {
  url: string
  secret?: string
  prompt: string
  sessionId: string
  sessionAttributes: Record<string, string>
}): Promise<{ content: string; sessionId?: string; error?: string }> {
  const res = await fetch(params.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(params.secret ? { 'x-ai-director-secret': params.secret } : {}),
    },
    body: JSON.stringify({
      prompt: params.prompt,
      sessionId: params.sessionId,
      sessionAttributes: params.sessionAttributes,
    }),
    cache: 'no-store',
  })

  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // ignore
  }

  if (!res.ok) {
    return {
      content: '',
      error: json?.error || `Lambda invoke failed (HTTP ${res.status})`,
    }
  }

  return {
    content: json?.content || json?.response || '',
    sessionId: json?.sessionId,
    error: json?.error,
  }
}

/**
 * Detect language from message content
 * Simple heuristic based on character sets
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

function getExternalDataApiNotReachableMessage(params: {
  language: string
  apiBaseUrl: string
  status?: number
}): { error: string; hint: string } {
  const statusText = typeof params.status === 'number' ? ` (HTTP ${params.status})` : ''

  if (params.language === 'he') {
    return {
      error: `ה-CRM לא נגיש דרך כתובת ה-ngrok שמוגדרת כרגע${statusText}.`,
      hint:
        `בדוק שה-ngrok מפנה ל-CRM על פורט 3001, ושהמשתנה NEXT_PUBLIC_APP_URL הוא בדיוק כתובת ה-ngrok הזו (לדוגמה: ngrok http 3001).`,
    }
  }

  if (params.language === 'ru') {
    return {
      error: `CRM недоступна по текущему ngrok URL${statusText}.`,
      hint:
        `Проверь, что ngrok проброшен на CRM порт 3001 и что NEXT_PUBLIC_APP_URL равен этому ngrok URL (например: ngrok http 3001).`,
    }
  }

  return {
    error: `CRM is not reachable via the currently configured ngrok URL${statusText}.`,
    hint:
      `Make sure ngrok forwards to the CRM dev server on port 3001 and that NEXT_PUBLIC_APP_URL equals that ngrok URL (example: ngrok http 3001).`,
  }
}

async function preflightExternalDataApi(params: {
  companyId: string
  apiBaseUrl: string
  apiToken: string
  language: string
}): Promise<NextResponse | null> {
  const isDev = process.env.NODE_ENV !== 'production'
  const base = params.apiBaseUrl?.trim()
  if (!isDev || !base || base.includes('localhost')) return null

  const url = `${base.replace(/\/$/, '')}/api/ai-director/data/leads?company_id=${encodeURIComponent(params.companyId)}&limit=1`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 2000)

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'x-api-token': params.apiToken },
      cache: 'no-store',
      signal: controller.signal,
    })

    if (res.ok) return null

    const { error, hint } = getExternalDataApiNotReachableMessage({
      language: params.language,
      apiBaseUrl: params.apiBaseUrl,
      status: res.status,
    })

    console.error('[AI Director] External Data API preflight failed:', {
      url,
      status: res.status,
    })

    return NextResponse.json(
      {
        error,
        hint,
        checkedUrl: url,
        status: res.status,
      },
      { status: 502 }
    )
  } catch (error: any) {
    const { error: message, hint } = getExternalDataApiNotReachableMessage({
      language: params.language,
      apiBaseUrl: params.apiBaseUrl,
    })

    console.error('[AI Director] External Data API preflight error:', {
      url,
      message: error?.message || String(error),
    })

    return NextResponse.json(
      {
        error: message,
        hint,
        checkedUrl: url,
      },
      { status: 502 }
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

// Helper: Get or create director session
async function getOrCreateDirectorSession(companyId: string, sessionId?: string) {
  if (!supabase) throw new Error('Supabase not configured')
  
  if (sessionId) {
    const { data } = await supabase
      .from('ai_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('source', 'director')
      .single()
    
    if (data) return data
  }
  
  // Create new session
  const { data: newSession, error } = await supabase
    .from('ai_sessions')
    .insert({
      client_id: companyId,
      source: 'director',
      metadata: { company_id: companyId },
    })
    .select('*')
    .single()
  
  if (error) throw error
  return newSession
}

// Helper: Save message
async function saveMessage(sessionId: string, role: 'user' | 'assistant', content: string) {
  if (!supabase) return
  
  await supabase
    .from('ai_messages')
    .insert({
      session_id: sessionId,
      role,
      content,
    })
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

    const preflightError = await preflightExternalDataApi({
      companyId,
      apiBaseUrl: sessionAttributes.api_base_url,
      apiToken: sessionAttributes.api_token,
      language: detectedLanguage,
    })
    if (preflightError) return preflightError
    
    // Prefer Lambda invoke (keeps AWS credentials out of Vercel), fallback to direct Bedrock SDK
    const invokeLambdaUrl = process.env.AI_DIRECTOR_INVOKE_LAMBDA_URL?.trim()
    const invokeLambdaSecret = process.env.AI_DIRECTOR_INVOKE_LAMBDA_SECRET?.trim()

    const response = invokeLambdaUrl
      ? await callBedrockAgentViaLambda({
          url: invokeLambdaUrl,
          secret: invokeLambdaSecret,
          prompt: message,
          sessionId: session.id,
          sessionAttributes,
        })
      : await callBedrockAgent({
          prompt: message,
          sessionId: session.id,
          sessionAttributes,
        })
    
    if (response.error) {
      console.error('[AI Director] Bedrock error:', response.error)
      return NextResponse.json({ error: response.error }, { status: 500 })
    }
    
    // Save AI response
    await saveMessage(session.id, 'assistant', response.content)
    
    // Update session last_activity
    await supabase
      .from('ai_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', session.id)
    
    return NextResponse.json({
      response: response.content,
      sessionId: session.id,
    })
  } catch (error: any) {
    console.error('[AI Director] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ai-director/chat
 * 
 * Get chat history for current session
 * Query params: sessionId (optional)
 */
export async function GET(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error
  
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }
  
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')
    const companyId = authCheck.context?.companyId
    
    if (!sessionId) {
      // Return empty if no session
      return NextResponse.json({ messages: [] })
    }
    
    // Verify session belongs to company
    const { data: session } = await supabase
      .from('ai_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('client_id', companyId)
      .eq('source', 'director')
      .single()
    
    if (!session) {
      return NextResponse.json({ messages: [] })
    }
    
    // Get messages
    const { data: messages } = await supabase
      .from('ai_messages')
      .select('role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
    
    return NextResponse.json({ messages: messages || [] })
  } catch (error: any) {
    console.error('[AI Director] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

