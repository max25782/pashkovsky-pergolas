/**
 * Single entry point for the sales-chat Gemini call, shared by the internal
 * (/api/ai-chat) and public (/api/public/ai-chat) routes.
 *
 * Guarantees:
 * 1. SYSTEM_PROMPT goes in `systemInstruction`.
 * 2. Function calling: model may call `calculate_price`; we execute it locally
 *    and feed the result back before the final text reply is produced.
 * 3. Duplicate guard: if the generated reply is too similar to any previous
 *    assistant turn in this session, we retry once with an explicit correction.
 * 4. Leak guard: reasoning leaks are retried then replaced with a safe line.
 * 5. Truncation guard: responses cut mid-sentence (< 60 chars or ending mid-word)
 *    are treated as leaked/invalid and retried.
 */

import {
  SYSTEM_PROMPT,
  AI_CONFIG,
  SAFE_FALLBACK_REPLY,
  fewShotExamples,
  TOOL_DECLARATIONS,
  executeCalculatePrice,
} from './config'
import { sanitizeAndInspect, inspectResponse } from './response-sanitizer'

export interface GeminiImageData {
  mimeType: string
  data: string
}

export interface HistoryMessage {
  role: string
  content: string
}

// ─── Gemini API types ─────────────────────────────────────────────────────────

interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
  functionCall?: { name: string; args: Record<string, unknown> }
  functionResponse?: { name: string; response: { result: string } }
}

interface GeminiContent {
  role: 'user' | 'model' | 'function'
  parts: GeminiPart[]
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[]; role?: string }
  finishReason?: string
}

interface GeminiResponseBody {
  candidates?: GeminiCandidate[]
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// ─── Retry correction message ────────────────────────────────────────────────

const RETRY_CORRECTION =
  'ההודעה הקודמת שלך נפסלה כי היא לא הייתה הודעה ללקוח. ' +
  'כתוב עכשיו רק את הודעת הצ\'אט עצמה, 3–5 שורות, בלי רשימות, בלי תוויות ובלי הסבר.'

const DUPLICATE_CORRECTION =
  'כבר שלחת תשובה דומה לזו בשיחה הזאת. אל תחזור על אותה פסקה. ' +
  'תן תשובה שונה — קצרה, שונה בניסוח ובתוכן.'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Drop history entries that are themselves leaks or truncations. */
function usableHistory(messages: HistoryMessage[]): HistoryMessage[] {
  return messages.filter((m) => {
    if (m.role !== 'assistant') return true
    const text = m.content.trim()
    if (!text || text.length < 10) return false                  // empty / truncated
    if (inspectResponse(text).leaked) return false               // leaked reasoning
    return true
  })
}

/** True if `newText` is too similar to any previous assistant reply. */
function isDuplicate(newText: string, history: HistoryMessage[]): boolean {
  const norm = (s: string) =>
    s.replace(/\s+/g, ' ').trim().slice(0, 120).toLowerCase()
  const newNorm = norm(newText)
  if (newNorm.length < 15) return false
  return history.some((m) => {
    if (m.role !== 'assistant') return false
    return norm(m.content) === newNorm
  })
}

/** True if text looks cut off mid-sentence. */
function isTruncated(text: string): boolean {
  const t = text.trim()
  if (t.length < 30) return true
  // Ends mid-word: last char is a Hebrew/Latin letter (no punctuation, space, ?, !, .)
  const lastChar = t[t.length - 1]
  if (/[\u05d0-\u05ea\u0041-\u007a\u0400-\u04ff]/.test(lastChar)) return true
  return false
}

function buildContents(
  history: HistoryMessage[],
  userMessage: string,
  imageData: GeminiImageData | undefined,
  extraCorrection: string | null,
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
  if (imageData) userParts.push({ inlineData: { mimeType: imageData.mimeType, data: imageData.data } })
  contents.push({ role: 'user', parts: userParts })

  if (extraCorrection) {
    contents.push({ role: 'user', parts: [{ text: extraCorrection }] })
  }

  return contents
}

// ─── Gemini API call (single turn, may include function call round-trip) ──────

async function callGemini(
  contents: GeminiContent[],
  temperature: number,
  logPrefix: string,
): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured')

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.model}:generateContent?key=${GEMINI_API_KEY}`

  const requestBody = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    generationConfig: {
      temperature,
      maxOutputTokens: AI_CONFIG.maxTokens,
    },
  }

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  })

  if (!res.ok) {
    const errorText = await res.text()
    let detail = errorText.slice(0, 200)
    try {
      const parsed = JSON.parse(errorText) as { error?: { message?: string; status?: string } }
      detail = parsed.error?.message ?? parsed.error?.status ?? detail
    } catch { /* keep raw */ }
    console.error(`${logPrefix} Gemini API error:`, { status: res.status, detail })
    throw new Error(`Gemini API error (${res.status}): ${detail}`)
  }

  const data = (await res.json()) as GeminiResponseBody
  const candidate = data.candidates?.[0]
  if (!candidate) throw new Error('No response from Gemini API')

  const parts = candidate.content?.parts ?? []

  // ── Function call handling ──────────────────────────────────────────────────
  const fnCall = parts.find((p) => p.functionCall)?.functionCall
  if (fnCall?.name === 'calculate_price') {
    // Execute the tool locally
    const priceResult = executeCalculatePrice(
      fnCall.args as unknown as Parameters<typeof executeCalculatePrice>[0]
    )
    console.log(`${logPrefix} calculate_price(${JSON.stringify(fnCall.args)}) → ${priceResult}`)

    // Feed tool result back to Gemini for the final text reply
    const contentsWithTool: GeminiContent[] = [
      ...contents,
      { role: 'model', parts: [{ functionCall: fnCall }] },
      {
        role: 'function' as const,
        parts: [{ functionResponse: { name: 'calculate_price', response: { result: priceResult } } }],
      },
    ]

    const res2 = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...requestBody, contents: contentsWithTool }),
    })

    if (!res2.ok) {
      const errText = await res2.text()
      throw new Error(`Gemini tool-response error (${res2.status}): ${errText.slice(0, 200)}`)
    }

    const data2 = (await res2.json()) as GeminiResponseBody
    return (data2.candidates?.[0]?.content?.parts ?? [])
      .map((p) => (typeof p.text === 'string' ? p.text : ''))
      .join('')
      .trim()
  }

  // ── Normal text reply ────────────────────────────────────────────────────────
  return parts
    .map((p) => (typeof p.text === 'string' ? p.text : ''))
    .join('')
    .trim()
}

// ─── Public interface ─────────────────────────────────────────────────────────

export interface SalesReply {
  /** Customer-facing text. Never a leak — safe to stream and to persist. */
  text: string
  /** True when both attempts leaked/duplicated and SAFE_FALLBACK_REPLY was substituted. */
  usedFallback: boolean
}

/**
 * Produce one customer-facing reply. Handles:
 * - Function calling (calculate_price)
 * - Leak detection + retry
 * - Duplicate detection + retry
 * - Truncation detection + retry
 */
export async function generateSalesReply(params: {
  history: HistoryMessage[]
  userMessage: string
  imageData?: GeminiImageData
  logPrefix: string
}): Promise<SalesReply> {
  const { history, userMessage, imageData, logPrefix } = params

  // ── Attempt 1: normal call ──────────────────────────────────────────────────
  const rawFirst = await callGemini(
    buildContents(history, userMessage, imageData, null),
    AI_CONFIG.temperature,
    logPrefix,
  )
  const first = sanitizeAndInspect(rawFirst)

  if (!first.leaked && !isTruncated(first.text)) {
    if (!isDuplicate(first.text, history)) {
      return { text: first.text, usedFallback: false }
    }
    console.warn(`${logPrefix} Duplicate detected — retrying with correction`)
  } else {
    const reason = isTruncated(first.text) ? 'truncated' : first.reason
    console.warn(`${logPrefix} Response rejected (${reason}) — retrying`)
  }

  // ── Attempt 2: retry with appropriate correction ────────────────────────────
  const correction = isDuplicate(first.text, history) ? DUPLICATE_CORRECTION : RETRY_CORRECTION
  const rawSecond = await callGemini(
    buildContents(history, userMessage, imageData, correction),
    0.3,
    logPrefix,
  )
  const second = sanitizeAndInspect(rawSecond)

  if (!second.leaked && !isTruncated(second.text)) {
    return { text: second.text, usedFallback: false }
  }

  console.error(`${logPrefix} Retry also rejected — using safe fallback`)
  return { text: SAFE_FALLBACK_REPLY, usedFallback: true }
}
