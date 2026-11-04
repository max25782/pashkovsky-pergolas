/**
 * Amazon Bedrock Client — AI Director (CRM assistant only).
 *
 * Calls a Bedrock Agent. Supports the RETURN_CONTROL action-group pattern:
 * Bedrock asks our code to fetch data → we call the CRM data API → we send
 * results back to Bedrock → Bedrock returns the final text answer.
 *
 * Do not use this module for public AI Chat (`/api/ai-chat`) — that stays on Gemini.
 */

const AWS_REGION = process.env.AWS_REGION || 'us-east-1'
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY
const BEDROCK_AGENT_ID = process.env.BEDROCK_AGENT_ID
const BEDROCK_AGENT_ALIAS_ID = process.env.BEDROCK_AGENT_ALIAS_ID || 'TSTALIASID'

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
      signal: AbortSignal.timeout(10_000),
    })
    return await res.text()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return JSON.stringify({ error: `Failed to call ${functionName}: ${msg}` })
  }
}

export async function callBedrockAgent({
  prompt,
  sessionId,
  sessionAttributes,
}: BedrockCallParams): Promise<BedrockResponse> {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let commandInput: any = {
    agentId: BEDROCK_AGENT_ID,
    agentAliasId: BEDROCK_AGENT_ALIAS_ID,
    sessionId: currentSessionId,
    inputText: prompt,
    ...(sessionAttributes
      ? { sessionState: { sessionAttributes } }
      : {}),
  }

  const MAX_TOOL_CALLS = 5
  let toolCallCount = 0

  while (toolCallCount <= MAX_TOOL_CALLS) {
    const command = new InvokeAgentCommand(commandInput)
    const response = await client.send(command)

    let responseText = ''
    let returnControlPayload: {
      invocationId?: string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invocationInputs?: any[]
    } | null = null

    if (response.completion) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const chunk of response.completion as AsyncIterable<any>) {
        if (chunk.chunk?.bytes) {
          const decoder = new TextDecoder()
          responseText += decoder.decode(chunk.chunk.bytes)
        }
        if (chunk.returnControl) {
          returnControlPayload = chunk.returnControl
        }
      }
    }

    if (responseText) {
      return { content: responseText, sessionId: currentSessionId }
    }

    if (returnControlPayload && returnControlPayload.invocationId) {
      toolCallCount++

      const invocationId = returnControlPayload.invocationId
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: any[] = []

      for (const input of returnControlPayload.invocationInputs ?? []) {
        const fi = input.functionInvocationInput
        if (!fi) continue

        const fnName: string = fi.function ?? ''
        const params: Array<{ name?: string; type?: string; value?: string }> =
          fi.parameters ?? []

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
        sessionState: {
          ...(sessionAttributes ? { sessionAttributes } : {}),
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
}

export function isBedrockConfigured(): boolean {
  return !!(BEDROCK_AGENT_ID && AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && AWS_REGION)
}
