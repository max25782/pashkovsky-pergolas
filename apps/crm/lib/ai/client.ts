/**
 * AI Client for Analytics
 * 
 * Reusable client for calling LLM models (Gemini)
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

export interface CallLLMParams {
  systemPrompt: string
  userMessage: string
  contextData?: string // JSON string or other context data
  temperature?: number
  maxTokens?: number
}

export interface LLMResponse {
  content: string
  error?: string
}

/**
 * Call Gemini LLM with system prompt, user message, and optional context
 */
export async function callLLM({
  systemPrompt,
  userMessage,
  contextData,
  temperature = 0.7,
  maxTokens = 2000,
}: CallLLMParams): Promise<LLMResponse> {
  if (!GEMINI_API_KEY) {
    return {
      content: '',
      error: 'Gemini API key not configured',
    }
  }

  // Build Gemini contents array
  const geminiContents: any[] = [
    {
      role: 'user',
      parts: [{ text: systemPrompt }],
    },
  ]

  // Add context data as separate message if provided
  if (contextData) {
    geminiContents.push({
      role: 'user',
      parts: [{ text: `DATA:\n${contextData}` }],
    })
  }

  // Add user message
  geminiContents.push({
    role: 'user',
    parts: [{ text: userMessage }],
  })

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`

  const requestBody = {
    contents: geminiContents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = 'Failed to get AI response'
      
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error?.message || errorJson.error?.status || errorMessage
      } catch {
        errorMessage = errorText.substring(0, 200) || errorMessage
      }

      console.error('[AI Analytics] Gemini API error:', {
        status: response.status,
        error: errorMessage.substring(0, 500), // Limit log size
      })

      return {
        content: '',
        error: errorMessage,
      }
    }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    if (!content) {
      return {
        content: '',
        error: 'Empty response from AI model',
      }
    }

    return {
      content,
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[AI Analytics] Request error:', {
      error: msg?.substring(0, 500), // Limit log size
    })

    return {
      content: '',
      error: msg || 'Unknown error occurred',
    }
  }
}

