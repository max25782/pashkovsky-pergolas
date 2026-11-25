/**
 * AI Director Chat API
 * Handles chat requests to the AI Director (Bedrock Agent)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { checkAIDirectorAccess } from '@/lib/middleware/ai-director-subscription'
import { callBedrockAgent } from '@/lib/ai/bedrock-client'
import { buildBusinessSnapshot, readSnapshotCache, writeSnapshotCache } from '@/lib/ai/business-snapshot'
import { createClient } from '@supabase/supabase-js'
import { aiDirectorLimiter, aiDirectorUserLimiter, checkLimit } from '@/lib/middleware/rate-limit'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY)
  : null

async function requireDirectorRole(userId: string, companyId: string): Promise<NextResponse | null> {
  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  const { data } = await supabase
    .from('company_members')
    .select('role')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (data?.role !== 'owner' && data?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

async function businessSnapshot(companyId: string, force: boolean): Promise<string> {
  const now = Date.now()
  if (!force) {
    const cached = readSnapshotCache(companyId, now)
    if (cached) return cached
  }
  if (!supabase) return ''
  const since90 = new Date(now - 90 * 86_400_000).toISOString()
  const since30 = new Date(now - 30 * 86_400_000).toISOString().slice(0, 10)
  const [dealsRes, leadsRes, workersRes, shiftsRes, stagesRes] = await Promise.all([
    supabase.from('deals').select('stage, price, project_type, created_at, updated_at').eq('company_id', companyId).limit(400),
    supabase.from('leads').select('source, status, created_at').eq('company_id', companyId).gte('created_at', since90).limit(400),
    supabase.from('workers').select('id').eq('company_id', companyId).eq('is_active', true).limit(200),
    supabase.from('work_shifts').select('id').eq('company_id', companyId).gte('date', since30).limit(400),
    supabase.from('deal_stages').select('key, role').eq('company_id', companyId),
  ])
  const closedStageKeys = (stagesRes.error ? [] : stagesRes.data ?? [])
    .filter((row) => row.role === 'completed' && row.key)
    .map((row) => row.key)
  const text = buildBusinessSnapshot({
    now: new Date(now),
    closedStageKeys,
    deals: (dealsRes.data ?? []).map((row) => ({
      stage: row.stage ?? null,
      price: row.price == null ? null : Number(row.price),
      projectType: row.project_type ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    leads: (leadsRes.data ?? []).map((row) => ({
      source: row.source ?? null,
      status: row.status ?? null,
      createdAt: row.created_at,
    })),
    activeWorkers: workersRes.data?.length ?? 0,
    shiftsLast30Days: (shiftsRes.data ?? []).length,
  })
  writeSnapshotCache(companyId, text, now)
  return text
}

function sse(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

/**
 * Call Bedrock via Lambda proxy (if configured)
 */
async function callBedrockAgentViaLambda(params: {
  url: string
  secret?: string
  prompt: string
  sessionId: string
  sessionAttributes: Record<string, string>
  promptSessionAttributes?: Record<string, string>
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
      promptSessionAttributes: params.promptSessionAttributes,
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

function detectLanguage(message: string): 'he' | 'ru' | 'en' {
  if (/[\u0590-\u05FF]/.test(message)) return 'he'
  if (/[\u0400-\u04FF]/.test(message)) return 'ru'
  if (/[A-Za-z]/.test(message)) return 'en'
  return 'he'
}

function acceptedLanguage(value: unknown): 'he' | 'ru' | 'en' | null {
  return value === 'he' || value === 'ru' || value === 'en' ? value : null
}

/** The saved message stays as typed. The model is told which language to use. */
function promptForModel(message: string, language: string): string {
  const instruction = language === 'ru'
    ? 'Ответь на русском языке.'
    : language === 'en'
      ? 'Answer in English.'
      : 'ענה בעברית.'
  return `${instruction}\n${message}`
}

class DirectorSessionNotFoundError extends Error {
  constructor() {
    super('Session not found')
    this.name = 'DirectorSessionNotFoundError'
  }
}

/**
 * Get or create AI Director session.
 * If sessionId is provided it must belong to companyId — otherwise 404 (no silent create).
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
      .maybeSingle()

    if (!existing) {
      throw new DirectorSessionNotFoundError()
    }

    await supabase
      .from('ai_director_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', existing.id)
      .eq('company_id', companyId)

    return { id: existing.id }
  }

  const { data: newSession, error } = await supabase
    .from('ai_director_sessions')
    .insert({
      company_id: companyId,
    })
    .select('id')
    .single()

  if (error || !newSession) {
    throw new Error('Failed to create session')
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
 * Preflight check for external data API (non-blocking)
 * This is a soft check - if it fails, we log a warning but don't block the request
 */
async function preflightExternalDataApi(apiBaseUrl: string): Promise<void> {
  // Skip check if URL is not configured
    if (!apiBaseUrl || apiBaseUrl.trim() === '') {
    console.warn('[AI Director] NEXT_PUBLIC_APP_URL is not set - Bedrock agent may not be able to fetch data')
    return
  }

  // Ensure URL has protocol
  let normalizedUrl = apiBaseUrl.trim()
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`
  }

  try {
    const healthUrl = `${normalizedUrl}/api/ai-director/data/deals?company_id=test&limit=1`
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        'x-api-token': process.env.AI_DIRECTOR_API_TOKEN || '',
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(3000), // 3 second timeout
    })

    if (!response.ok && response.status !== 400) {
      console.warn('[AI Director] Preflight check failed:', {
        status: response.status,
        url: healthUrl,
        hint: 'Bedrock agent may not be able to fetch data, but chat will still work',
      })
    } else {
    }
  } catch (error: unknown) {
    // Log warning but don't block - Bedrock agent will handle API errors gracefully
    console.warn('[AI Director] Preflight check error (non-blocking):', {
      error: error instanceof Error ? error.message : String(error),
      url: normalizedUrl,
      hint: 'This is a soft check. Bedrock agent will attempt to fetch data when needed.',
    })
  }
}

/**
 * GET /api/ai-director/chat
 * 
 * Get chat history for current company's AI Director session
 */
export async function GET(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error
  
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }
  
  try {
    const companyId = authCheck.context?.companyId
    
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
    }

    const roleError = await requireDirectorRole(authCheck.user.id, companyId)
    if (roleError) return roleError

    const accessCheck = await checkAIDirectorAccess(authCheck.user.id)
    if (accessCheck) return accessCheck

    // Get the most recent session for this company
    const { data: session } = await supabase
      .from('ai_director_sessions')
      .select('id')
      .eq('company_id', companyId)
      .order('last_activity', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!session) {
      return NextResponse.json({ messages: [], sessionId: null })
    }

    // Get messages for this session
    const { data: messages, error: messagesError } = await supabase
      .from('ai_director_messages')
      .select('role, content, created_at')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('[AI Director] Error loading messages:', messagesError)
      return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 })
    }

    return NextResponse.json({
      messages: messages || [],
      sessionId: session.id,
    })
  } catch (error: unknown) {
    console.error('[AI Director] GET error:', error)
    return NextResponse.json({ error: 'Failed to load chat history' }, { status: 500 })
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
    const body = await req.json()
    const message = body?.message
    const sessionId = body?.sessionId
    const language = body?.language
    const companyId = authCheck.context?.companyId
    
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
    }

    const roleError = await requireDirectorRole(authCheck.user.id, companyId)
    if (roleError) return roleError

    const accessCheck = await checkAIDirectorAccess(authCheck.user.id)
    if (accessCheck) return accessCheck
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Rate limit — 50 messages per company per day
    const rl = await checkLimit(aiDirectorLimiter, `director:${companyId}`)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Daily AI Director message limit reached. Try again tomorrow.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
      )
    }
    const userRl = await checkLimit(aiDirectorUserLimiter, `director-user:${authCheck.user.id}`)
    if (!userRl.allowed) {
      return NextResponse.json(
        { error: 'Too many AI Director messages. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(userRl.retryAfter) } },
      )
    }

    // Detect language from message if not provided
    const detectedLanguage = acceptedLanguage(language) ?? detectLanguage(message)
    
    // Get or create session
    const session = await getOrCreateDirectorSession(companyId, sessionId)
    
    // Save user message
    await saveMessage(session.id, 'user', message)
    
    // Prepare session attributes
    // Normalize api_base_url: add protocol if missing
    let apiBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || ''
    if (apiBaseUrl && !apiBaseUrl.startsWith('http://') && !apiBaseUrl.startsWith('https://')) {
      // Default to https in production, http in development
      apiBaseUrl = process.env.NODE_ENV === 'production' ? `https://${apiBaseUrl}` : `http://${apiBaseUrl}`
    }

    const sessionAttributes = {
      company_id: companyId,
      api_base_url: apiBaseUrl,
      api_token: process.env.AI_DIRECTOR_API_TOKEN || '',
      user_language: detectedLanguage,
    }
    
    if (!sessionAttributes.api_token) {
      console.error('[AI Director] API token is not configured')
      return NextResponse.json({ error: 'AI Director is not configured' }, { status: 500 })
    }

    await preflightExternalDataApi(sessionAttributes.api_base_url)
    const snapshot = await businessSnapshot(companyId, !sessionId || body?.refreshSnapshot === true)
    const invokeLambdaUrl = process.env.AI_DIRECTOR_INVOKE_LAMBDA_URL
    const invokeLambdaSecret = process.env.AI_DIRECTOR_INVOKE_LAMBDA_SECRET
    const promptSessionAttributes = {
      business_snapshot: snapshot,
      user_language: detectedLanguage,
    }

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => controller.enqueue(sse(event, data))
        try {
          send('status', { phase: 'thinking' })
          let content = ''
          let typewriter = false
          let returnedSession = session.id
          if (invokeLambdaUrl && invokeLambdaSecret) {
            const viaLambda = await callBedrockAgentViaLambda({
              url: invokeLambdaUrl,
              secret: invokeLambdaSecret,
              prompt: promptForModel(message, detectedLanguage),
              sessionId: session.id,
              sessionAttributes,
              promptSessionAttributes,
            })
            if (viaLambda.error) throw new Error('agent_failed')
            content = viaLambda.content
            typewriter = true
            if (content) send('delta', { text: content })
            returnedSession = viaLambda.sessionId || session.id
          } else {
            const bedrockResponse = await callBedrockAgent({
              prompt: promptForModel(message, detectedLanguage),
              sessionId: session.id,
              sessionAttributes,
              promptSessionAttributes,
              onStatus: (phase) => send('status', { phase }),
              onDelta: (piece) => {
                content += piece
                send('delta', { text: piece })
              },
            })
            if (bedrockResponse.error) throw new Error('agent_failed')
            if (!content) content = bedrockResponse.content
            typewriter = bedrockResponse.typewriter === true
            returnedSession = bedrockResponse.sessionId || session.id
          }
          if (content) await saveMessage(session.id, 'assistant', content)
          send('done', { sessionId: returnedSession, typewriter })
        } catch {
          send('error', { code: 'failed' })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    })
  } catch (error: unknown) {
    if (error instanceof DirectorSessionNotFoundError) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    console.error('[AI Director] Chat error:', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json(
      { error: 'AI Director temporarily unavailable' },
      { status: 500 },
    )
  }
}

// Hobby Fluid Compute: maxDuration ceiling is 300s. Must be a numeric literal for Next.js.
// Browser client waits AI_DIRECTOR_CLIENT_TIMEOUT_MS (120s).
export const dynamic = 'force-dynamic'
export const maxDuration = 300
