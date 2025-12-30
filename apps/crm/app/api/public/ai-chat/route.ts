/**
 * Public AI Chat API Endpoint
 * For use by the public website (apps/site)
 * 
 * Security:
 * - Site token validation (x-site-token)
 * - Rate limiting (IP-based)
 * - Same Gemini API config as internal chat
 */

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SYSTEM_PROMPT, AI_CONFIG } from '@/lib/ai-chat/config'

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!
const SITE_TOKEN = process.env.CRM_SITE_TOKEN!

// Initialize Supabase client with service role
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null

// Rate limiting storage (in-memory, simple implementation)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(clientId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const key = `public:${clientId}`
  const limit = AI_CONFIG.rateLimitPerHour
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(key)
  
  // Reset if expired
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 3600000 } // 1 hour
    rateLimitStore.set(key, entry)
  }
  
  // Check limit
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }
  
  // Increment count
  entry.count++
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

async function getOrCreateSession(clientId: string): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured')
  
  // Try to find existing session for this client
  const { data: existing } = await supabase
    .from('ai_sessions')
    .select('id')
    .eq('client_id', clientId)
    .eq('source', 'website')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  
  if (existing) {
    return existing.id
  }
  
  // Create new session
  const { data: newSession, error } = await supabase
    .from('ai_sessions')
    .insert({
      client_id: clientId,
      source: 'website',
      metadata: { ip: getClientIp({ headers: { get: () => null } } as any) }
    })
    .select('id')
    .single()
  
  if (error) throw error
  return newSession.id
}

async function getChatHistory(sessionId: string): Promise<Array<{ role: string; content: string }>> {
  if (!supabase) return []
  
  const { data: messages } = await supabase
    .from('ai_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(50)
  
  return messages || []
}

async function saveMessage(sessionId: string, role: string, content: string): Promise<void> {
  if (!supabase) return
  
  await supabase.from('ai_messages').insert({
    session_id: sessionId,
    role,
    content,
  })
}

async function* streamGeminiResponse(
  messages: Array<{ role: string; content: string }>,
  userMessage: string,
  imageData?: { mimeType: string; data: string }
): AsyncGenerator<string> {
  if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured')

  const geminiContents: any[] = [
    {
      role: 'user',
      parts: [{ text: SYSTEM_PROMPT }],
    },
  ]

  messages.forEach((m) => {
    geminiContents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })
  })

  const userParts: any[] = []
  if (userMessage) {
    userParts.push({ text: userMessage })
  }
  if (imageData) {
    userParts.push({
      inlineData: {
        mimeType: imageData.mimeType,
        data: imageData.data,
      },
    })
  }
  
  geminiContents.push({
    role: 'user',
    parts: userParts,
  })

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.model}:generateContent?key=${GEMINI_API_KEY}`

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: geminiContents,
      generationConfig: {
        temperature: AI_CONFIG.temperature,
        maxOutputTokens: AI_CONFIG.maxTokens,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Public AI Chat] Gemini API error:', errorText)
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  
  // Stream the text word by word
  const words = text.split(' ')
  for (const word of words) {
    yield word + ' '
    await new Promise(resolve => setTimeout(resolve, 30))
  }
}

// CORS helper
function jsonResponse(data: any, options: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_SITE_URL || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-site-token',
      ...options.headers,
    },
  })
}

export async function OPTIONS() {
  return jsonResponse({}, { status: 200 })
}

export async function GET(req: NextRequest) {
  // Validate site token
  const siteToken = req.headers.get('x-site-token')
  if (!siteToken || siteToken !== SITE_TOKEN) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Get client ID from query
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) {
    return jsonResponse({ error: 'clientId required' }, { status: 400 })
  }
  
  try {
    const sessionId = await getOrCreateSession(clientId)
    const messages = await getChatHistory(sessionId)
    
    return jsonResponse({
      messages,
      sessionId,
    })
  } catch (error: any) {
    console.error('[Public AI Chat] GET error:', error)
    return jsonResponse({ error: 'Failed to load chat history' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Validate site token
    const siteToken = req.headers.get('x-site-token')
    if (!siteToken || siteToken !== SITE_TOKEN) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 })
    }
    
    if (!supabase || !GEMINI_API_KEY) {
      return jsonResponse({ error: 'Service not configured' }, { status: 500 })
    }
    
    // 2. Parse request
    let message: string = ''
    let clientId: string = ''
    let imageFile: File | null = null
    let imageData: { mimeType: string; data: string } | undefined = undefined
    
    const contentType = req.headers.get('content-type') || ''
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      message = (formData.get('message') as string) || ''
      clientId = (formData.get('clientId') as string) || ''
      imageFile = (formData.get('image') as File) || null
      
      if (imageFile) {
        const buffer = await imageFile.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        imageData = {
          mimeType: imageFile.type || 'image/jpeg',
          data: base64,
        }
      }
    } else {
      const body = await req.json()
      message = body.message || ''
      clientId = body.clientId || ''
    }
    
    if (!clientId) {
      return jsonResponse({ error: 'clientId required' }, { status: 400 })
    }
    
    if (!message.trim() && !imageData) {
      return jsonResponse({ error: 'Message or image required' }, { status: 400 })
    }
    
    // 3. Rate limiting
    const rateLimit = checkRateLimit(clientId)
    if (!rateLimit.allowed) {
      return jsonResponse(
        { error: 'Rate limit exceeded', remaining: 0 },
        { status: 429 }
      )
    }
    
    // 4. Get or create session
    const sessionId = await getOrCreateSession(clientId)
    
    // 5. Get chat history
    const history = await getChatHistory(sessionId)
    
    // 6. Save user message
    await saveMessage(sessionId, 'user', message || 'תמונה')
    
    // 7. Stream response
    const encoder = new TextEncoder()
    let fullResponse = ''
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamGeminiResponse(history, message, imageData)) {
            fullResponse += chunk
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
          }
          
          // Send done signal
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, remaining: rateLimit.remaining })}\n\n`
            )
          )
          
          // Save assistant message
          await saveMessage(sessionId, 'assistant', fullResponse)
          
          controller.close()
        } catch (error: any) {
          console.error('[Public AI Chat] Stream error:', error)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`)
          )
          controller.close()
        }
      },
    })
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_SITE_URL || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-site-token',
      },
    })
  } catch (error: any) {
    console.error('[Public AI Chat] POST error:', error)
    return jsonResponse({ error: 'Internal server error' }, { status: 500 })
  }
}

