/**
 * AI Director Client
 *
 * Uses Google Gemini API with function calling to answer CRM queries.
 * Maintains the same public interface as the original Bedrock client
 * so the rest of the codebase requires no changes.
 *
 * When the model requests data it calls our internal CRM data endpoints
 * (RETURN_CONTROL pattern equivalent), feeds the result back, and loops
 * until the model returns a final text answer.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

export interface BedrockCallParams {
  prompt: string
  sessionId?: string
  /** company_id, api_base_url, api_token, user_language */
  sessionAttributes?: Record<string, string>
  temperature?: number
  maxTokens?: number
}

export interface BedrockResponse {
  content: string
  sessionId?: string
  error?: string
}

// ---------------------------------------------------------------------------
// CRM function definitions (exposed to Gemini as tools)
// ---------------------------------------------------------------------------

const CRM_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'get_deals',
        description:
          'Fetch deals (leads/clients) from the CRM. Use this to get sales data, pipeline stats, or deal details.',
        parameters: {
          type: 'OBJECT',
          properties: {
            stage: {
              type: 'STRING',
              description: 'Filter by deal stage (e.g. new, in_progress, won, lost)',
            },
            start_date: { type: 'STRING', description: 'Start date filter YYYY-MM-DD' },
            end_date: { type: 'STRING', description: 'End date filter YYYY-MM-DD' },
            limit: { type: 'NUMBER', description: 'Max number of records to return (default 20)' },
          },
          required: [],
        },
      },
      {
        name: 'get_leads',
        description: 'Fetch recent leads from the CRM.',
        parameters: {
          type: 'OBJECT',
          properties: {
            status: { type: 'STRING', description: 'Filter by lead status' },
            limit: { type: 'NUMBER', description: 'Max number of records to return' },
          },
          required: [],
        },
      },
      {
        name: 'get_offers',
        description: 'Fetch offers/quotes sent to clients.',
        parameters: {
          type: 'OBJECT',
          properties: {
            status: { type: 'STRING', description: 'Filter by offer status' },
            start_date: { type: 'STRING', description: 'Start date filter YYYY-MM-DD' },
            end_date: { type: 'STRING', description: 'End date filter YYYY-MM-DD' },
            limit: { type: 'NUMBER', description: 'Max number of records to return' },
          },
          required: [],
        },
      },
      {
        name: 'get_analytics',
        description: 'Fetch sales analytics and KPIs for the company.',
        parameters: {
          type: 'OBJECT',
          properties: {
            period: {
              type: 'STRING',
              description: 'Time period (e.g. today, week, month, year)',
            },
          },
          required: [],
        },
      },
      {
        name: 'get_workers',
        description: 'Fetch team members / sales workers in the company.',
        parameters: {
          type: 'OBJECT',
          properties: {
            limit: { type: 'NUMBER', description: 'Max number of records to return' },
          },
          required: [],
        },
      },
    ],
  },
]

const FUNCTION_TO_PATH: Record<string, string> = {
  get_deals: '/api/ai-director/data/deals',
  get_leads: '/api/ai-director/data/leads',
  get_offers: '/api/ai-director/data/offers',
  get_analytics: '/api/ai-director/data/analytics',
  get_workers: '/api/ai-director/data/workers',
}

// ---------------------------------------------------------------------------
// CRM function dispatcher
// ---------------------------------------------------------------------------

async function dispatchCRMFunction(
  functionName: string,
  args: Record<string, unknown>,
  apiBaseUrl: string,
  apiToken: string,
  companyId: string,
): Promise<string> {
  const path = FUNCTION_TO_PATH[functionName]
  if (!path) {
    return JSON.stringify({ error: `Unknown function: ${functionName}` })
  }

  const qs = new URLSearchParams()
  // Always inject company_id from session — Gemini doesn't need to pass it explicitly
  if (companyId) qs.set('company_id', companyId)
  for (const [k, v] of Object.entries(args)) {
    if (v != null && k !== 'company_id') qs.set(k, String(v))
  }

  const url = `${apiBaseUrl}${path}?${qs.toString()}`

  try {
    const res = await fetch(url, {
      headers: { 'x-api-token': apiToken },
      signal: AbortSignal.timeout(10_000),
    })
    return await res.text()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return JSON.stringify({ error: `Failed to call ${functionName}: ${msg}` })
  }
}

// ---------------------------------------------------------------------------
// System instruction
// ---------------------------------------------------------------------------

function buildSystemInstruction(companyId: string, userLanguage: string): string {
  const langInstruction =
    userLanguage === 'ru'
      ? 'Respond in Russian (Русский). Use Russian for all output.'
      : 'Respond ONLY in Hebrew (עברית). Never switch to English, even if the user writes in English.'

  return `You are an AI Director for a pergola/aluminum products CRM system. You help managers analyze their sales pipeline, deals, leads, and team performance.

You have access to CRM data tools. Use them when the user asks about:
- Deals, clients, pipeline, sales stages
- Leads, new inquiries
- Offers and quotes sent
- Analytics, KPIs, revenue, conversion rates
- Team members and workers

DEAL STAGES (in order):
new → measure → offer → offer_approved → material_ordered → approved → production → install → done

STAGE TRANSLATION TABLE — always use Hebrew names when displaying stages to the user:
- new              → חדש
- measure          → מדידה
- offer            → הצעה
- offer_approved   → הצעה אושרה
- material_ordered → חומר הוזמן
- approved         → מאושר
- production       → ייצור
- install          → התקנה
- done             → הושלם

STAGE GROUPS (use these definitions automatically — never ask the user to clarify):
- "active" deals = stages: measure, offer, offer_approved, material_ordered, approved, production, install
- "new" deals = stage: new
- "completed" deals = stage: done
- "in progress" / "not new and not done" / "open pipeline" = same as "active" above

IMPORTANT RULES:
1. ALWAYS fetch real data first before answering — never say "I don't know" without trying the tools.
2. NEVER ask "which stages?" — the get_deals tool has no stage filter in this context, so fetch ALL deals (no stage parameter) and then filter/group the results yourself in your response.
3. When a user asks for deals "not in stage X" or "excluding X" — fetch all deals, then exclude those stages yourself when presenting results.
4. When asked about "active", "in progress", or "open" deals — fetch all deals and show only stages: measure, offer, offer_approved, material_ordered, approved, production, install.
5. When asked about "hot leads" or "best leads" — fetch leads and rank by: newest first, stage priority (new > in_progress), and any available scoring data.
6. When asked about counts or totals — fetch data and count yourself, don't ask the user for criteria.
7. "Hot" leads = recently created leads in 'new' or 'in_progress' status that haven't been contacted yet.
8. Format numbers clearly: use currency symbols, show counts, highlight important items.
9. If a tool call fails or returns empty — report what you found (even if nothing) rather than asking for clarification.
10. NEVER ask clarifying questions about stages, dates, or filters — make the most useful assumption and fetch the data.

Be concise, professional, and business-focused. ${langInstruction}

Current company_id: ${companyId}`
}

// ---------------------------------------------------------------------------
// Gemini API helpers
// ---------------------------------------------------------------------------

interface GeminiMessage {
  role: 'user' | 'model'
  parts: Array<
    | { text: string }
    | { functionCall: { name: string; args: Record<string, unknown> } }
    | { functionResponse: { name: string; response: { content: string } } }
  >
}

async function callGeminiAPI(
  messages: GeminiMessage[],
  systemInstruction: string,
): Promise<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured')

  const url = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: messages,
    tools: CRM_TOOLS,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${errText.substring(0, 300)}`)
  }

  const data = await res.json()

  const candidate = data.candidates?.[0]
  if (!candidate) throw new Error('No candidates in Gemini response')

  const parts = candidate.content?.parts ?? []

  for (const part of parts) {
    if (part.functionCall) {
      return { functionCall: { name: part.functionCall.name, args: part.functionCall.args ?? {} } }
    }
    if (part.text) {
      return { text: part.text }
    }
  }

  return { text: '' }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function callBedrockAgent({
  prompt,
  sessionId,
  sessionAttributes,
}: BedrockCallParams): Promise<BedrockResponse> {
  if (!GEMINI_API_KEY) {
    return {
      content: '',
      error: 'AI Director configuration error: GEMINI_API_KEY is not set.',
    }
  }

  const companyId = sessionAttributes?.company_id ?? ''
  const apiBaseUrl = sessionAttributes?.api_base_url ?? ''
  const apiToken = sessionAttributes?.api_token ?? ''
  const userLanguage = sessionAttributes?.user_language ?? 'en'

  const systemInstruction = buildSystemInstruction(companyId, userLanguage)

  const currentSessionId =
    sessionId ?? `session-${Date.now()}-${Math.random().toString(36).substring(7)}`

  const messages: GeminiMessage[] = [{ role: 'user', parts: [{ text: prompt }] }]

  const MAX_TOOL_CALLS = 5
  let toolCallCount = 0

  while (toolCallCount <= MAX_TOOL_CALLS) {
    const result = await callGeminiAPI(messages, systemInstruction)

    if (result.text !== undefined) {
      return { content: result.text, sessionId: currentSessionId }
    }

    if (result.functionCall) {
      toolCallCount++
      const { name, args } = result.functionCall

      // Add the model's function call to history
      messages.push({ role: 'model', parts: [{ functionCall: { name, args } }] })

      // Execute the function
      const fnResult = await dispatchCRMFunction(name, args, apiBaseUrl, apiToken, companyId)

      // Add function response to history
      messages.push({
        role: 'user',
        parts: [{ functionResponse: { name, response: { content: fnResult } } }],
      })

      continue
    }

    return { content: '', error: 'Empty response from AI model.', sessionId: currentSessionId }
  }

  return {
    content: '',
    error: 'AI Director exceeded maximum tool call iterations.',
    sessionId: currentSessionId,
  }
}

/**
 * Check if AI Director is configured
 */
export function isBedrockConfigured(): boolean {
  return !!GEMINI_API_KEY
}
