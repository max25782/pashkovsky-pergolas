import { drainAgentCompletion } from '@/lib/ai/drain-agent-completion'

/**
 * Amazon Bedrock Client — AI Director (CRM assistant only).
 *
 * Calls a Bedrock Agent. Supports the RETURN_CONTROL action-group pattern:
 * Bedrock asks our code to fetch data → we call the CRM data API → we send
 * results back to Bedrock → Bedrock returns the final text answer.
 *
 * Do not use this module for public AI Chat (`/api/ai-chat`) — that stays on Gemini.
 */

function envTrim(name: string): string | undefined {
  const v = process.env[name]
  if (v == null) return undefined
  // Strip CRLF / accidental whitespace from pasted Vercel / .env values.
  const t = v.replace(/^\uFEFF/, '').trim()
  return t.length > 0 ? t : undefined
}

// Bedrock Agents live in us-east-1 for this project. Do not reuse AWS_REGION —
// that is often set to eu-north-1 for the gallery S3 bucket.
const AWS_REGION =
  envTrim('BEDROCK_AWS_REGION')
  || envTrim('AWS_BEDROCK_REGION')
  || 'us-east-1'
const AWS_ACCESS_KEY_ID = envTrim('AWS_ACCESS_KEY_ID')
const AWS_SECRET_ACCESS_KEY = envTrim('AWS_SECRET_ACCESS_KEY')
const BEDROCK_AGENT_ID = envTrim('BEDROCK_AGENT_ID')
const BEDROCK_AGENT_ALIAS_ID = envTrim('BEDROCK_AGENT_ALIAS_ID') || 'TSTALIASID'

export interface BedrockCallParams {
  prompt: string
  sessionId?: string
  /** company_id, api_base_url, api_token, user_language. Never send this map to the browser. */
  sessionAttributes?: Record<string, string>
  /** Business summary only. No token and no company id. */
  promptSessionAttributes?: Record<string, string>
  streamFinalResponse?: boolean
  onStatus?: (phase: 'thinking' | 'crm') => void
  onDelta?: (piece: string) => void
  temperature?: number
  maxTokens?: number
}

export interface BedrockResponse {
  content: string
  sessionId?: string
  error?: string
  /** True when the model returned one block and the browser should reveal it gradually. */
  typewriter?: boolean
}

interface ReturnControlPayload {
  invocationId?: string
  invocationInputs?: unknown[]
}

const FUNCTION_TO_PATH: Record<string, string> = {
  get_deals: '/api/ai-director/data/deals',
  get_leads: '/api/ai-director/data/leads',
  get_offers: '/api/ai-director/data/offers',
  get_analytics: '/api/ai-director/data/analytics',
  get_workers: '/api/ai-director/data/workers',
}

async function dispatchCRMFunction(
  functionName: string,
  parameters: Array<{ name?: string; type?: string; value?: string }>,
  apiBaseUrl: string,
  apiToken: string,
  companyId: string,
): Promise<string> {
  const path = FUNCTION_TO_PATH[functionName]
  if (!path) {
    return JSON.stringify({ error: `Unknown function: ${functionName}` })
  }

  const qs = new URLSearchParams()
  // Always inject company_id from session — agent params may omit it.
  if (companyId) qs.set('company_id', companyId)
  for (const p of parameters) {
    if (p.name && p.value != null && p.name !== 'company_id') qs.set(p.name, p.value)
  }

  const url = `${apiBaseUrl}${path}?${qs.toString()}`

  try {
    const res = await fetch(url, {
      headers: { 'x-api-token': apiToken },
      signal: AbortSignal.timeout(25_000),
    })
    return await res.text()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return JSON.stringify({ error: `Failed to call ${functionName}: ${msg}` })
  }
}

function streamWasRejected(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /streamFinalResponse|streamingConfigurations|ValidationException|Unknown parameter/i.test(message)
}

export async function callBedrockAgent(params: BedrockCallParams): Promise<BedrockResponse> {
  const stream = params.streamFinalResponse !== false
  const first = await invokeBedrockAgent(params, stream)
  if (stream && first.error && streamWasRejected(new Error(first.error))) {
    return invokeBedrockAgent({ ...params, streamFinalResponse: false }, false)
  }
  return first
}

async function invokeBedrockAgent(
  {
    prompt,
    sessionId,
    sessionAttributes,
    promptSessionAttributes,
    onStatus,
    onDelta,
  }: BedrockCallParams,
  streamFinalResponse: boolean,
): Promise<BedrockResponse> {
  if (!BEDROCK_AGENT_ID || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    return {
      content: '',
      error:
        'Bedrock credentials not configured. Please set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and BEDROCK_AGENT_ID',
    }
  }

  const { BedrockAgentRuntimeClient, InvokeAgentCommand } = await import(
    '@aws-sdk/client-bedrock-agent-runtime'
  )

  const client = new BedrockAgentRuntimeClient({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  })

  const currentSessionId =
    sessionId || `session-${Date.now()}-${Math.random().toString(36).substring(7)}`

  const apiBaseUrl = sessionAttributes?.api_base_url || ''
  const apiToken = sessionAttributes?.api_token || ''
  const companyId = sessionAttributes?.company_id || ''

  const sessionState = {
    ...(sessionAttributes ? { sessionAttributes } : {}),
    ...(promptSessionAttributes ? { promptSessionAttributes } : {}),
  }
  let commandInput: Record<string, unknown> = {
    agentId: BEDROCK_AGENT_ID,
    agentAliasId: BEDROCK_AGENT_ALIAS_ID,
    sessionId: currentSessionId,
    inputText: prompt,
    ...(streamFinalResponse ? { streamingConfigurations: { streamFinalResponse: true } } : {}),
    ...(Object.keys(sessionState).length > 0 ? { sessionState } : {}),
  }

  const MAX_TOOL_CALLS = 5
  let toolCallCount = 0

  try {
    while (toolCallCount <= MAX_TOOL_CALLS) {
      onStatus?.('thinking')
      const command = new InvokeAgentCommand(
        commandInput as unknown as ConstructorParameters<typeof InvokeAgentCommand>[0],
      )
      const response = await client.send(command)

      let responseText = ''
      let returnControlPayload: ReturnControlPayload | null = null

      // InvokeAgent returns a stream. Do not answer, and do not attach an abort
      // signal, until every chunk of this round has arrived.
      if (response.completion) {
        const drained = await drainAgentCompletion(
          response.completion as AsyncIterable<{
            chunk?: { bytes?: Uint8Array }
            returnControl?: { invocationId?: string; invocationInputs?: unknown[] }
          }>,
          streamFinalResponse ? onDelta : undefined,
        )
        responseText = drained.text
        returnControlPayload = drained.returnControl ?? null
      }

      if (responseText) {
        if (!streamFinalResponse) onDelta?.(responseText)
        return { content: responseText, sessionId: currentSessionId, typewriter: !streamFinalResponse }
      }

      if (returnControlPayload && returnControlPayload.invocationId) {
        toolCallCount++

        const invocationId = returnControlPayload.invocationId
        const results: Array<Record<string, unknown>> = []

        for (const input of returnControlPayload.invocationInputs ?? []) {
          const fi = (input as { functionInvocationInput?: {
            function?: string
            actionGroup?: string
            parameters?: Array<{ name?: string; type?: string; value?: string }>
          } }).functionInvocationInput
          if (!fi) continue

          const fnName: string = fi.function ?? ''
          const params: Array<{ name?: string; type?: string; value?: string }> =
            fi.parameters ?? []

          onStatus?.('crm')
          const resultBody = await dispatchCRMFunction(
            fnName,
            params,
            apiBaseUrl,
            apiToken,
            companyId,
          )

          results.push({
            functionResult: {
              actionGroup: fi.actionGroup ?? 'CRMDataAPI',
              function: fnName,
              responseBody: {
                TEXT: { body: resultBody },
              },
            },
          })
        }

        commandInput = {
          agentId: BEDROCK_AGENT_ID,
          agentAliasId: BEDROCK_AGENT_ALIAS_ID,
          sessionId: currentSessionId,
          ...(streamFinalResponse ? { streamingConfigurations: { streamFinalResponse: true } } : {}),
          sessionState: {
            ...(sessionAttributes ? { sessionAttributes } : {}),
            ...(promptSessionAttributes ? { promptSessionAttributes } : {}),
            invocationId,
            returnControlInvocationResults: results,
          },
        }

        continue
      }

      return {
        content: '',
        error:
          'Empty response from Bedrock agent. Check AWS Console logs and ensure the agent is prepared.',
        sessionId: currentSessionId,
      }
    }

    return {
      content: '',
      error: 'Bedrock agent exceeded maximum tool call iterations.',
      sessionId: currentSessionId,
    }
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string; Code?: string }
    const message = e?.message || String(err)
    console.error('[Bedrock] InvokeAgent failed:', {
      name: e?.name,
      code: e?.Code,
      message,
      region: AWS_REGION,
      agentId: BEDROCK_AGENT_ID,
      aliasId: BEDROCK_AGENT_ALIAS_ID,
    })
    return {
      content: '',
      error: `Bedrock InvokeAgent failed (${AWS_REGION}/${BEDROCK_AGENT_ID}): ${message}`,
      sessionId: currentSessionId,
    }
  }
}

export function isBedrockConfigured(): boolean {
  return !!(BEDROCK_AGENT_ID && AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && AWS_REGION)
}
