import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { SYSTEM_PROMPT, AI_CONFIG, COOKIE_NAME, COOKIE_MAX_AGE, fewShotExamples } from '@/lib/ai-chat/config'
import { isAppointmentConfirmation, extractAppointment } from '@/lib/ai-chat/appointment-detector'
import { sendCalendarInvite } from '@/lib/ai-chat/calendar-invite'
import { sanitizeInput } from '@/lib/ai-chat/xss-filter'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// Generate unique client ID
function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

// Get or create client ID from cookies
async function getClientId(): Promise<string> {
  const cookieStore = await cookies()
  let clientId = cookieStore.get(COOKIE_NAME)?.value
  
  if (!clientId) {
    clientId = generateClientId()
    cookieStore.set(COOKIE_NAME, clientId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    })
  }
  
  return clientId
}

// Check rate limit
async function checkRateLimit(clientId: string): Promise<{ allowed: boolean; remaining: number }> {
  if (!supabase) return { allowed: true, remaining: AI_CONFIG.rateLimitPerHour }
  
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  
  // Get or create rate limit record
  const { data: rateLimit } = await supabase
    .from('ai_rate_limits')
    .select('*')
    .eq('client_id', clientId)
    .single()
  
  if (!rateLimit) {
    // Create new rate limit record
    await supabase.from('ai_rate_limits').insert({
      client_id: clientId,
      message_count: 1,
      window_start: new Date().toISOString(),
    })
    return { allowed: true, remaining: AI_CONFIG.rateLimitPerHour - 1 }
  }
  
  // Check if window has expired
  if (new Date(rateLimit.window_start) < new Date(oneHourAgo)) {
    // Reset window
    await supabase
      .from('ai_rate_limits')
      .update({ message_count: 1, window_start: new Date().toISOString() })
      .eq('client_id', clientId)
    return { allowed: true, remaining: AI_CONFIG.rateLimitPerHour - 1 }
  }
  
  // Check if limit exceeded
  if (rateLimit.message_count >= AI_CONFIG.rateLimitPerHour) {
    return { allowed: false, remaining: 0 }
  }
  
  // Increment count
  await supabase
    .from('ai_rate_limits')
    .update({ message_count: rateLimit.message_count + 1 })
    .eq('client_id', clientId)
  
  return { allowed: true, remaining: AI_CONFIG.rateLimitPerHour - rateLimit.message_count - 1 }
}

// Get or create session
async function getOrCreateSession(clientId: string): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured')
  
  const sessionTimeout = new Date(Date.now() - AI_CONFIG.sessionTimeoutHours * 60 * 60 * 1000).toISOString()
  
  // Find active session
  const { data: existingSession } = await supabase
    .from('ai_sessions')
    .select('id, last_activity')
    .eq('client_id', clientId)
    .gte('last_activity', sessionTimeout)
    .order('last_activity', { ascending: false })
    .limit(1)
    .single()
  
  if (existingSession) {
    // Update last activity
    await supabase
      .from('ai_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', existingSession.id)
    return existingSession.id
  }
  
  // Create new session
  const { data: newSession, error } = await supabase
    .from('ai_sessions')
    .insert({ client_id: clientId })
    .select('id')
    .single()
  
  if (error || !newSession) {
    console.error('[AI Chat] Supabase error while creating session:', {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    })
    throw new Error('Failed to create session')
  }
  return newSession.id
}

// Get chat history
async function getChatHistory(sessionId: string): Promise<Array<{ role: string; content: string }>> {
  if (!supabase) return []
  
  const { data: messages } = await supabase
    .from('ai_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(AI_CONFIG.maxHistoryMessages)
  
  return messages || []
}

// Save message
async function saveMessage(sessionId: string, role: 'user' | 'assistant', content: string): Promise<void> {
  if (!supabase) return
  
  await supabase.from('ai_messages').insert({
    session_id: sessionId,
    role,
    content,
  })
}

// Convert image file to base64
async function imageToBase64(file: File): Promise<{ mimeType: string; data: string }> {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const base64 = buffer.toString('base64')
  return {
    mimeType: file.type || 'image/jpeg',
    data: base64,
  }
}

// Tag keywords → media_assets tag mapping
const TAG_KEYWORDS: Array<{ keywords: string[]; tag: string }> = [
  { keywords: ['קלאסי', 'קלאסית', 'classic'], tag: 'פרגולה קלאסית' },
  { keywords: ['היי-טק', 'היטק', 'high tech', 'hightech'], tag: 'פרגולה היי-טק' },
  { keywords: ['מטבח חוץ', 'מטבח', 'kitchen'], tag: 'פרגולה למטבח חוץ' },
  { keywords: ['ביוקלמטיק', 'bioclimatic'], tag: 'פרגולה ביוקלמטיק' },
  { keywords: ['pvc', 'פי וי סי'], tag: 'פרגולה pvc' },
  { keywords: ['תלויה', 'hanging', 'suspended'], tag: 'פרגולה תלויה' },
  { keywords: ['עץ', 'wood', 'wooden'], tag: 'פרגולה דמוי עץ' },
  { keywords: ['זכוכית', 'glass', 'יוקרה'], tag: 'פרגולה יוקרה עם כיסוי זכוכית' },
]

/**
 * Detect which pergola tags appear in the AI response text and fetch
 * matching presigned image URLs from media_assets.
 * Falls back to "פרגולה קלאסית" (most common) if nothing matches.
 */
async function fetchImagesByContext(text: string): Promise<string[]> {
  const lower = text.toLowerCase()
  const detectedTags = TAG_KEYWORDS
    .filter(({ keywords }) => keywords.some((kw) => lower.includes(kw.toLowerCase())))
    .map(({ tag }) => tag)

  const tagsToQuery = detectedTags.length > 0 ? [detectedTags[0]] : ['פרגולה קלאסית']

  try {
    const host = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'

    const res = await fetch(`${host}/api/media/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: tagsToQuery, limit: 3, random: true }),
      signal: AbortSignal.timeout(5000),
    })

    if (res.ok) {
      const data: { items: Array<{ url: string }> } = await res.json()
      const urls = data.items.map((i) => i.url).filter(Boolean)
      console.log(`[AI Chat] Media query (${tagsToQuery[0]}): ${urls.length} images`)
      if (urls.length > 0) return urls
    } else {
      console.warn('[AI Chat] Media query returned', res.status)
    }
  } catch (e) {
    console.warn('[AI Chat] Media query failed, no images returned:', e)
  }

  return []
}

// Call Gemini API (non-streaming under the hood, streamed to client)
async function* streamGeminiResponse(
  messages: Array<{ role: string; content: string }>,
  userMessage: string,
  imageData?: { mimeType: string; data: string }
): AsyncGenerator<string> {
  if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured')

  // Build conversation history for Gemini
  // Always start with system prompt so the model keeps the correct persona,
  // even for old sessions that были созданы до обновления промпта.
  const geminiContents: any[] = [
    {
      role: 'user',
      parts: [{ text: SYSTEM_PROMPT }],
    },
    // Few-shot examples teach the model the correct tone and response style
    // before any real conversation history
    ...fewShotExamples,
  ]

  // Full history from Supabase
  messages.forEach((m) => {
    geminiContents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })
  })

  // Current user message with optional image
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

  const requestBody = {
    contents: geminiContents,
    generationConfig: {
      temperature: AI_CONFIG.temperature,
      maxOutputTokens: AI_CONFIG.maxTokens,
    },
  }

  console.log('[AI Chat] Calling Gemini API (non-streaming):', {
    model: AI_CONFIG.model,
    messageCount: geminiContents.length,
    url: apiUrl.replace(GEMINI_API_KEY, '***'),
  })

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[AI Chat] Gemini API HTTP error:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText.substring(0, 1000),
      url: apiUrl.replace(GEMINI_API_KEY, '***'),
      hasApiKey: !!GEMINI_API_KEY,
      apiKeyLength: GEMINI_API_KEY?.length || 0,
    })

    let errorMessage = 'Failed to get AI response'
    let errorDetails: any = {}

    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = errorJson.error?.message || errorJson.error?.status || errorMessage
      errorDetails = {
        code: errorJson.error?.code,
        status: errorJson.error?.status,
        details: errorJson.error?.details,
      }
      console.error('[AI Chat] Parsed error:', errorDetails)
    } catch {
      errorMessage = errorText.substring(0, 200) || errorMessage
    }

    const fullError = `Gemini API error (${response.status}): ${errorMessage}${
      errorDetails.code ? ` [${errorDetails.code}]` : ''
    }`
    console.error('[AI Chat] Full error message:', fullError)
    throw new Error(fullError)
  }

  const data = await response.json()

  const candidates = data?.candidates || []
  if (!candidates.length) {
    console.error('[AI Chat] No candidates in Gemini response:', JSON.stringify(data).slice(0, 500))
    throw new Error('No chunks received from Gemini API. Check API key and model availability.')
  }

  // Concatenate all text parts into a single answer, then stream it out in chunks
  const parts = candidates[0]?.content?.parts || []
  const fullText = parts
    .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
    .join('')
    .trim()

  if (!fullText) {
    console.error('[AI Chat] Empty text in Gemini response:', JSON.stringify(data).slice(0, 500))
    throw new Error('No chunks received from Gemini API. Check API key and model availability.')
  }

  // Check if AI wants to send images (format: [IMAGE:url1,url2,url3])
  const imageMatch = fullText.match(/\[IMAGE:([^\]]+)\]/)
  let imageUrls: string[] = []
  let textWithoutImageTag = fullText
  
  if (imageMatch) {
    // Extract image URLs
    imageUrls = imageMatch[1].split(',').map((url: string) => url.trim()).filter(Boolean)
    // Remove image tag from text
    textWithoutImageTag = fullText.replace(/\[IMAGE:[^\]]+\]/g, '').trim()
    
    // If AI requested images but didn't provide URLs, query media_assets by detected tags
    if (imageUrls.length === 0 || imageUrls[0].startsWith('placeholder')) {
      imageUrls = await fetchImagesByContext(fullText)
    }
  }

  // Stream out text in small chunks
  const chunkSize = 120
  for (let i = 0; i < textWithoutImageTag.length; i += chunkSize) {
    const chunk = textWithoutImageTag.slice(i, i + chunkSize)
    yield chunk
  }
  
  // After text is streamed, yield image URLs if any
  if (imageUrls.length > 0) {
    yield `\n\n[IMAGES:${imageUrls.join(',')}]`
  }
}

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      console.error('[AI Chat] Supabase not configured')
      return new Response(JSON.stringify({ error: 'Server not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    if (!GEMINI_API_KEY) {
      console.error('[AI Chat] Gemini API key not configured')
      return new Response(JSON.stringify({ error: 'AI service not configured. Check GEMINI_API_KEY.' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Validate API key format (Gemini keys usually start with AIza)
    if (!GEMINI_API_KEY.startsWith('AIza') && GEMINI_API_KEY.length < 30) {
      console.warn('[AI Chat] API key format looks suspicious, length:', GEMINI_API_KEY.length)
    }
    
    // Parse request - can be JSON or FormData
    let rawMessage: string = ''
    let imageFile: File | null = null
    let imageData: { mimeType: string; data: string } | undefined = undefined
    
    const contentType = req.headers.get('content-type') || ''
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      rawMessage = (formData.get('message') as string) || ''
      imageFile = formData.get('image') as File | null
      
      if (imageFile && imageFile.size > 0) {
        // Validate image
        if (!imageFile.type.startsWith('image/')) {
          return new Response(JSON.stringify({ error: 'Invalid file type. Only images are allowed.' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        
        if (imageFile.size > 10 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: 'Image too large. Maximum 10MB.' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        
        imageData = await imageToBase64(imageFile)
      }
    } else {
      const body = await req.json()
      rawMessage = body.message || ''
    }
    
    // At least message or image must be provided
    if (!rawMessage.trim() && !imageData) {
      return new Response(JSON.stringify({ error: 'Message or image is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Sanitize text input (if provided)
    const message = rawMessage.trim() ? sanitizeInput(rawMessage.trim()) : ''
    if (rawMessage.trim() && !message) {
      return new Response(JSON.stringify({ error: 'Invalid message' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Get client ID
    let clientId: string
    try {
      clientId = await getClientId()
    } catch (error) {
      console.error('[AI Chat] Failed to get client ID:', error)
      return new Response(JSON.stringify({ error: 'Failed to initialize session' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Check rate limit
    let allowed: boolean, remaining: number
    try {
      const rateLimitResult = await checkRateLimit(clientId)
      allowed = rateLimitResult.allowed
      remaining = rateLimitResult.remaining
    } catch (error) {
      console.error('[AI Chat] Rate limit check failed:', error)
      // Continue anyway if rate limit check fails
      allowed = true
      remaining = AI_CONFIG.rateLimitPerHour
    }
    
    if (!allowed) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded. Please try again later.',
        remaining: 0
      }), { 
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Get or create session
    let sessionId: string
    try {
      sessionId = await getOrCreateSession(clientId)
    } catch (error) {
      console.error('[AI Chat] Failed to get/create session:', error)
      return new Response(JSON.stringify({ error: 'Failed to create session. Check if ai_sessions table exists.' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Get chat history
    let history: Array<{ role: string; content: string }>
    try {
      history = await getChatHistory(sessionId)
    } catch (error) {
      console.error('[AI Chat] Failed to get history:', error)
      history = []
    }
    
    // Save user message (with image indicator if image was sent)
    try {
      const messageToSave = message || (imageData ? 'תמונה' : '')
      await saveMessage(sessionId, 'user', messageToSave)
    } catch (error) {
      console.error('[AI Chat] Failed to save user message:', error)
      // Continue anyway
    }
    
    // Create streaming response
    const encoder = new TextEncoder()
    let fullResponse = ''
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log('[AI Chat] Starting Gemini stream, history length:', history.length)
          console.log('[AI Chat] GEMINI_API_KEY exists:', !!GEMINI_API_KEY)
          console.log('[AI Chat] Model:', AI_CONFIG.model)
          
          let chunkCount = 0
          let detectedImageUrls: string[] = []
          try {
            for await (const chunk of streamGeminiResponse(history, message, imageData)) {
              chunkCount++
              
              // Check if chunk contains image URLs
              const imageMatch = chunk.match(/\[IMAGES:([^\]]+)\]/)
              if (imageMatch) {
                detectedImageUrls = imageMatch[1].split(',').map(url => url.trim()).filter(Boolean)
                // Send images as separate data
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ images: detectedImageUrls })}\n\n`))
                // Don't add image tag to fullResponse
                const textChunk = chunk.replace(/\[IMAGES:[^\]]+\]/g, '').trim()
                if (textChunk) {
                  fullResponse += textChunk
                }
              } else {
                fullResponse += chunk
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
              }
              
              if (chunkCount === 1) {
                console.log('[AI Chat] First chunk received, length:', chunk.length)
              }
            }
          } catch (streamError: any) {
            console.error('[AI Chat] Error in streamGeminiResponse:', streamError)
            console.error('[AI Chat] Stream error details:', {
              message: streamError?.message,
              stack: streamError?.stack,
              name: streamError?.name
            })
            throw streamError
          }
          
          console.log('[AI Chat] Stream completed, total chunks:', chunkCount, 'total length:', fullResponse.length)
          
          // Save assistant response
          if (fullResponse) {
            try {
              await saveMessage(sessionId, 'assistant', fullResponse)
              console.log('[AI Chat] Assistant message saved')
            } catch (error) {
              console.error('[AI Chat] Failed to save assistant message:', error)
            }

            // Detect appointment confirmation and send calendar invite (fire-and-forget)
            if (isAppointmentConfirmation(fullResponse)) {
              console.log('[AI Chat] Appointment confirmation detected — sending calendar invite')
              const allMessages = [...history, { role: 'assistant', content: fullResponse }]
              extractAppointment(allMessages)
                .then((appt) => {
                  if (appt) return sendCalendarInvite(appt)
                })
                .catch((e) => console.error('[AI Chat] Calendar invite failed:', e))
            }
          } else {
            console.warn('[AI Chat] No response received from Gemini')
            if (chunkCount === 0) {
              throw new Error('No chunks received from Gemini API. Check API key and model availability.')
            }
          }
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, remaining })}\n\n`))
          controller.close()
        } catch (error: any) {
          console.error('[AI Chat] Streaming error:', error)
          console.error('[AI Chat] Error stack:', error?.stack)
          console.error('[AI Chat] Error name:', error?.name)
          const errorMessage = error?.message || 'Failed to generate response'
          console.error('[AI Chat] Sending error to client:', errorMessage)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`))
          controller.close()
        }
      }
    })
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
    
  } catch (error: any) {
    console.error('[AI Chat] POST error:', error)
    const errorMessage = error?.message || 'Internal server error'
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// GET - Get chat history for current session
export async function GET(req: NextRequest) {
  try {
    if (!supabase) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const clientId = await getClientId()
    const sessionTimeout = new Date(Date.now() - AI_CONFIG.sessionTimeoutHours * 60 * 60 * 1000).toISOString()
    
    // Find active session
    const { data: session } = await supabase
      .from('ai_sessions')
      .select('id')
      .eq('client_id', clientId)
      .gte('last_activity', sessionTimeout)
      .order('last_activity', { ascending: false })
      .limit(1)
      .single()
    
    if (!session) {
      return Response.json({ messages: [] })
    }
    
    // Get messages
    const { data: messages } = await supabase
      .from('ai_messages')
      .select('role, content, created_at')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
    
    return Response.json({ messages: messages || [] })
    
  } catch (error) {
    console.error('Get history error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

