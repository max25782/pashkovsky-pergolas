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
import { SYSTEM_PROMPT, AI_CONFIG, fewShotExamples } from '@/lib/ai-chat/config'
import { isAppointmentConfirmation, extractAppointment } from '@/lib/ai-chat/appointment-detector'
import { sendCalendarInvite } from '@/lib/ai-chat/calendar-invite'
import { fetchImagesByContext } from '@/lib/ai-chat/image-fetcher'

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

/** Get existing session only — does not create. Used for loading history. */
async function getSession(clientId: string): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('ai_sessions')
    .select('id')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return data?.id ?? null
}

/** Get or create session — creates only when user sends first message. */
async function getOrCreateSession(clientId: string, ip: string): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured')
  const existing = await getSession(clientId)
  if (existing) {
    await supabase
      .from('ai_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', existing)
    return existing
  }
  const { data: newSession, error } = await supabase
    .from('ai_sessions')
    .insert({
      client_id: clientId,
      metadata: { ip, source: 'website' },
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
    { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
    ...fewShotExamples,
  ]

  messages.forEach((m) => {
    geminiContents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })
  })

  const userParts: any[] = []
  if (userMessage) userParts.push({ text: userMessage })
  if (imageData) userParts.push({ inlineData: { mimeType: imageData.mimeType, data: imageData.data } })
  geminiContents.push({ role: 'user', parts: userParts })

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.model}:generateContent?key=${GEMINI_API_KEY}`

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: geminiContents,
      generationConfig: { temperature: AI_CONFIG.temperature, maxOutputTokens: AI_CONFIG.maxTokens },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Public AI Chat] Gemini API error:', errorText)
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const data = await response.json()
  const fullText: string = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''

  // Strip [IMAGE:...] tag and fetch real presigned images
  const imageMatch = fullText.match(/\[IMAGE:([^\]]+)\]/)
  let imageUrls: string[] = []
  let cleanText = fullText.replace(/\[IMAGE:[^\]]+\]/g, '').trim()

  if (imageMatch) {
    const raw = imageMatch[1].split(',').map((s) => s.trim()).filter((s) => s && !s.startsWith('placeholder'))
    imageUrls = raw.length > 0 ? raw : await fetchImagesByContext(fullText)
    if (imageUrls.length === 0) imageUrls = await fetchImagesByContext(fullText)
  }

  // Stream cleaned text in chunks
  const chunkSize = 120
  for (let i = 0; i < cleanText.length; i += chunkSize) {
    yield cleanText.slice(i, i + chunkSize)
  }

  // Yield image URLs separately so the client can render them below the text
  if (imageUrls.length > 0) {
    yield `\n\n[IMAGES:${imageUrls.join(',')}]`
  }
}

// CORS: allow production site and localhost (never use env fallback - it may be localhost in prod)
const ALLOWED_ORIGINS = [
  'https://www.pashkovsky-group.com',
  'https://pashkovsky-group.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
]
function getAllowedOrigin(origin: string | null): string {
  if (!origin) return '*' // Preflight may not always send Origin; allow for token-protected API
  if (ALLOWED_ORIGINS.includes(origin)) return origin
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return origin
  return '*'
}

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(origin),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-site-token',
  }
}

function jsonResponse(data: any, options: ResponseInit = {}, req?: NextRequest | null) {
  const origin = req?.headers.get('origin') || null
  return new Response(JSON.stringify(data), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
      ...(options.headers as Record<string, string>),
    },
  })
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin') || null
  return new Response(null, { status: 200, headers: corsHeaders(origin) })
}

export async function GET(req: NextRequest) {
  // Validate site token
  const siteToken = req.headers.get('x-site-token')
  if (!siteToken || siteToken !== SITE_TOKEN) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 }, req)
  }
  
  // Get client ID from query
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) {
    return jsonResponse({ error: 'clientId required' }, { status: 400 }, req)
  }
  
  try {
    const sessionId = await getSession(clientId)
    if (!sessionId) {
      return jsonResponse({ messages: [], sessionId: null }, {}, req)
    }
    const messages = await getChatHistory(sessionId)
    return jsonResponse({ messages, sessionId }, {}, req)
  } catch (error) {
    console.error('[Public AI Chat] GET error:', error)
    return jsonResponse({ error: 'Failed to load chat history' }, { status: 500 }, req)
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Validate site token
    const siteToken = req.headers.get('x-site-token')
    if (!siteToken || siteToken !== SITE_TOKEN) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 }, req)
    }
    
    if (!supabase || !GEMINI_API_KEY) {
      return jsonResponse({ error: 'Service not configured' }, { status: 500 }, req)
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
      return jsonResponse({ error: 'clientId required' }, { status: 400 }, req)
    }
    
    if (!message.trim() && !imageData) {
      return jsonResponse({ error: 'Message or image required' }, { status: 400 }, req)
    }
    
    // 3. Rate limiting
    const rateLimit = checkRateLimit(clientId)
    if (!rateLimit.allowed) {
      return jsonResponse(
        { error: 'Rate limit exceeded', remaining: 0 },
        { status: 429 },
        req
      )
    }
    
    // 4. Get or create session
    const ip = getClientIp(req)
    const sessionId = await getOrCreateSession(clientId, ip)
    
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
            // Intercept [IMAGES:...] marker and send as separate event
            const imgMatch = chunk.match(/\[IMAGES:([^\]]+)\]/)
            if (imgMatch) {
              const urls = imgMatch[1].split(',').map((u) => u.trim()).filter(Boolean)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ images: urls })}\n\n`))
              const textPart = chunk.replace(/\[IMAGES:[^\]]+\]/g, '').trim()
              if (textPart) {
                fullResponse += textPart
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: textPart })}\n\n`))
              }
            } else {
              fullResponse += chunk
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
            }
          }

          // Save assistant message (text only, no image markers)
          await saveMessage(sessionId, 'assistant', fullResponse)

          // Detect appointment confirmation and send calendar invite (fire-and-forget)
          if (isAppointmentConfirmation(fullResponse)) {
            const allMessages = [...history, { role: 'assistant', content: fullResponse }]
            extractAppointment(allMessages)
              .then((appt) => { if (appt) return sendCalendarInvite(appt) })
              .catch((e) => console.error('[Public AI Chat] Calendar invite failed:', e))
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true, remaining: rateLimit.remaining })}\n\n`)
          )
          controller.close()
        } catch (error: unknown) {
          console.error('[Public AI Chat] Stream error:', error)
          const msg = error instanceof Error ? error.message : String(error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
          controller.close()
        }
      },
    })
    
    const origin = req.headers.get('origin') || null
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...corsHeaders(origin),
      },
    })
  } catch (error) {
    console.error('[Public AI Chat] POST error:', error)
    return jsonResponse({ error: 'Internal server error' }, { status: 500 }, req)
  }
}

