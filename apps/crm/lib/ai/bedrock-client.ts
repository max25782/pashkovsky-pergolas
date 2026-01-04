/**
 * Amazon Bedrock Client
 * 
 * Client for calling Amazon Bedrock agents via MCP or direct API
 */

const AWS_REGION = process.env.AWS_REGION || 'us-east-1'
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY
const BEDROCK_AGENT_ID = process.env.BEDROCK_AGENT_ID
const BEDROCK_AGENT_ALIAS_ID = process.env.BEDROCK_AGENT_ALIAS_ID || 'TSTALIASID'

export interface BedrockCallParams {
  prompt: string
  sessionId?: string
  sessionAttributes?: Record<string, string> // For passing company_id, api_token, etc.
  temperature?: number
  maxTokens?: number
}

export interface BedrockResponse {
  content: string
  sessionId?: string
  error?: string
}

/**
 * Call Bedrock agent directly (without MCP)
 * Useful for server-side API routes
 */
export async function callBedrockAgent({
  prompt,
  sessionId,
  sessionAttributes,
}: BedrockCallParams): Promise<BedrockResponse> {
  if (!BEDROCK_AGENT_ID || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    return {
      content: '',
      error: 'Bedrock credentials not configured. Please set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and BEDROCK_AGENT_ID',
    }
  }

  try {
    // Dynamic import to avoid bundling AWS SDK in client-side code
    const { BedrockAgentRuntimeClient, InvokeAgentCommand } = await import('@aws-sdk/client-bedrock-agent-runtime')

    const client = new BedrockAgentRuntimeClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    })

    const currentSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).substring(7)}`

    const commandInput: any = {
      agentId: BEDROCK_AGENT_ID,
      agentAliasId: BEDROCK_AGENT_ALIAS_ID,
      sessionId: currentSessionId,
      inputText: prompt,
    }

    // Pass sessionAttributes (company_id, api_token, api_base_url) to agent
    if (sessionAttributes) {
      commandInput.sessionState = {
        sessionAttributes,
      }
    }

    const command = new InvokeAgentCommand(commandInput)
    const response = await client.send(command)

    console.log('[Bedrock] Response metadata:', {
      hasCompletion: !!response.completion,
      sessionId: response.sessionId,
    })

    // Read the response stream
    let responseText = ''
    let chunkCount = 0
    if (response.completion) {
      for await (const chunk of response.completion) {
        chunkCount++
        
        // Log full chunk structure for debugging
        console.log('[Bedrock] Chunk', chunkCount, 'full:', JSON.stringify(chunk, null, 2))
        
        console.log('[Bedrock] Chunk', chunkCount, 'summary:', {
          hasBytes: !!chunk.chunk?.bytes,
          hasAttribution: !!chunk.chunk?.attribution,
          hasTrace: !!chunk.trace,
          chunkKeys: chunk.chunk ? Object.keys(chunk.chunk) : [],
          type: chunk.chunk?.bytes ? 'bytes' : 'other',
        })
        
        if (chunk.chunk?.bytes) {
          const decoder = new TextDecoder()
          const text = decoder.decode(chunk.chunk.bytes)
          console.log('[Bedrock] Decoded text:', text.substring(0, 100))
          responseText += text
        }
        
        // Check for trace information (action group invocations)
        if (chunk.trace) {
          console.log('[Bedrock] Trace found:', JSON.stringify(chunk.trace, null, 2))
        }
      }
    }

    console.log('[Bedrock] Total chunks:', chunkCount, 'Response length:', responseText.length)

    if (!responseText) {
      console.error('[Bedrock] No text in response. This usually means:')
      console.error('1. Agent is trying to call action groups but they are not configured correctly')
      console.error('2. Agent Instructions do not tell it to use action groups')
      console.error('3. Action groups are not in PREPARED state')
      
      return {
        content: '',
        error: 'Empty response from Bedrock agent. Check AWS Console logs and ensure Action Groups are configured with "Return control".',
        sessionId: currentSessionId,
      }
    }

    return {
      content: responseText,
      sessionId: currentSessionId,
    }
  } catch (error: any) {
    console.error('[Bedrock] Error calling agent:', {
      error: error.message?.substring(0, 500),
      code: error.code,
    })

    return {
      content: '',
      error: error.message || 'Failed to call Bedrock agent',
    }
  }
}

/**
 * Check if Bedrock is configured
 */
export function isBedrockConfigured(): boolean {
  return !!(
    BEDROCK_AGENT_ID &&
    AWS_ACCESS_KEY_ID &&
    AWS_SECRET_ACCESS_KEY &&
    AWS_REGION
  )
}


