/**
 * Single entry point for the sales-chat Gemini call, shared by the internal
 * (/api/ai-chat) and public (/api/public/ai-chat) routes.
 *
 * Three guarantees this module provides that the previous inline calls did not:
 *
 * 1. SYSTEM_PROMPT goes in `systemInstruction`, not in a `user` turn. As a user
 *    turn it carried no more weight than the customer's messages, so "answer
 *    only with a number" or an English question could override the persona and
 *    the Hebrew-only rule.
 * 2. Every reply is inspected before it leaves this function. A leaked plan is
 *    retried once at low temperature and then replaced with a safe line, so the
 *    caller can only ever receive customer-facing text.
 * 3. History is filtered through the same inspection. Leaks persisted by
 *    earlier versions are dropped instead of being replayed as precedent.
 */

import { SYSTEM_PROMPT, AI_CONFIG, SAFE_FALLBACK_REPLY, fewShotExamples } from './config'
import { sanitizeAndInspect, inspectResponse } from './response-sanitizer'

export interface GeminiImageData {
  mimeType: string
  data: string
}

export interface HistoryMessage {
  role: string
  content: string
}

interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
}

interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

/**
 * Sent as an extra turn on the retry attempt only. Kept out of SYSTEM_PROMPT so
 * the normal path never sees wording that describes the failure mode.
 */
const RETRY_CORRECTION =
  'ההודעה הקודמת שלך נפסלה כי היא לא הייתה הודעה ללקוח. ' +
  'כתוב עכשיו רק את הודעת הצ\'אט עצמה בעברית, 3–5 שורות, בלי רשימות, בלי תוויות ובלי הסבר על התשובה.'

/** Drop history entries that are themselves leaks, so they stop shaping new replies. */
function usableHistory(messages: HistoryMessage[]): HistoryMessage[] {
  return messages.filter((m) => {
    if (m.role !== 'assistant') return true
    return !inspectResponse(m.content).leaked
  })
}

function buildContents(
  history: HistoryMessage[],
  userMessage: string,
  imageData: GeminiImageData | undefined,
  includeCorrection: boolean,
): GeminiContent[] {
  const contents: GeminiContent[] = [...(fewShotExamples as GeminiContent[])]

  for (const m of usableHistory(history)) {
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })
  }

  const userParts: GeminiPart[] = []
  if (userMessage) userParts.push({ text: userMessage })
  if (imageData) {
    userParts.push({ inlineData: { mimeType: imageData.mimeType, data: imageData.data } })
  }
  contents.push({ role: 'user', parts: userParts })

  if (includeCorrection) {
    contents.push({ role: 'user', parts: [{ text: RETRY_CORRECTION }] })
  }

  return contents
}

async function callGemini(
  contents: GeminiContent[],
  temperature: number,
  logPrefix: string,
): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured')

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.model}:generateContent?key=${GEMINI_API_KEY}`

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: AI_CONFIG.maxTokens,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let detail = errorText.slice(0, 200)
    try {
      const parsed = JSON.parse(errorText) as { error?: { message?: string; status?: string } }
      detail = parsed.error?.message ?? parsed.error?.status ?? detail
    } catch {
      // Non-JSON error body — keep the truncated raw text.
    }
    console.error(`${logPrefix} Gemini API error:`, { status: response.status, detail })
    throw new Error(`Gemini API error (${response.status}): ${detail}`)
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }

  const candidate = data.candidates?.[0]
  if (!candidate) {
    console.error(`${logPrefix} No candidates in Gemini response`)
    throw new Error('No response received from Gemini API. Check API key and model availability.')
  }

  return (candidate.content?.parts ?? [])
    .map((p) => (typeof p.text === 'string' ? p.text : ''))
    .join('')
    .trim()
}

export interface SalesReply {
  /** Customer-facing text. Never a leak — safe to stream and to persist. */
  text: string
  /** True when both attempts leaked and SAFE_FALLBACK_REPLY was substituted. */
  usedFallback: boolean
}

/**
 * Produce one customer-facing Hebrew reply. Retries once when the model leaks
 * its reasoning, then substitutes a safe line rather than exposing the prompt.
 */
export async function generateSalesReply(params: {
  history: HistoryMessage[]
  userMessage: string
  imageData?: GeminiImageData
  logPrefix: string
}): Promise<SalesReply> {
  const { history, userMessage, imageData, logPrefix } = params

  const first = sanitizeAndInspect(
    await callGemini(buildContents(history, userMessage, imageData, false), AI_CONFIG.temperature, logPrefix),
  )

  if (!first.leaked) return { text: first.text, usedFallback: false }

  console.warn(`${logPrefix} Response rejected (${first.reason}) — retrying once`)

  const second = sanitizeAndInspect(
    await callGemini(buildContents(history, userMessage, imageData, true), 0.2, logPrefix),
  )

  if (!second.leaked) return { text: second.text, usedFallback: false }

  console.error(`${logPrefix} Retry also rejected (${second.reason}) — using safe fallback`)
  return { text: SAFE_FALLBACK_REPLY, usedFallback: true }
}
