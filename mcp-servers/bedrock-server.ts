#!/usr/bin/env node
/**
 * MCP Server for Amazon Bedrock
 * 
 * This server allows Cursor AI to interact with Amazon Bedrock agents
 * without requiring user intervention.
 * 
 * Usage:
 *   tsx bedrock-server.ts
 * 
 * Environment variables:
 *   AWS_REGION - AWS region (e.g., us-east-1)
 *   AWS_ACCESS_KEY_ID - AWS access key
 *   AWS_SECRET_ACCESS_KEY - AWS secret key
 *   BEDROCK_AGENT_ID - Your Bedrock agent ID
 *   BEDROCK_AGENT_ALIAS_ID - Your Bedrock agent alias ID (optional)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime'

// Initialize Bedrock Agent client
function getBedrockClient() {
  const region = process.env.AWS_REGION || 'us-east-1'
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID || ''
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || ''
  
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials not configured')
  }
  
  return new BedrockAgentRuntimeClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })
}

const AGENT_ID = process.env.BEDROCK_AGENT_ID || ''
const AGENT_ALIAS_ID = process.env.BEDROCK_AGENT_ALIAS_ID || 'TSTALIASID'

// Create MCP server
const server = new Server(
  {
    name: 'bedrock-agent',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
)

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'invoke_bedrock_agent',
        description: 'Invoke Amazon Bedrock agent with a prompt. Returns the agent\'s response.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'The prompt/question to send to the Bedrock agent',
            },
            sessionId: {
              type: 'string',
              description: 'Optional session ID for maintaining conversation context',
            },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'list_bedrock_agents',
        description: 'List all available Bedrock agents',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  }
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    if (name === 'invoke_bedrock_agent') {
      const { prompt, sessionId } = args as { prompt: string; sessionId?: string }

      if (!AGENT_ID) {
        throw new Error('BEDROCK_AGENT_ID environment variable is not set')
      }

      const client = getBedrockClient()
      const command = new InvokeAgentCommand({
        agentId: AGENT_ID,
        agentAliasId: AGENT_ALIAS_ID,
        sessionId: sessionId || `session-${Date.now()}`,
        inputText: prompt,
      })

      const response = await client.send(command)

      // Read the response stream
      let responseText = ''
      if (response.completion) {
        for await (const chunk of response.completion) {
          if (chunk.chunk?.bytes) {
            const decoder = new TextDecoder()
            responseText += decoder.decode(chunk.chunk.bytes)
          }
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: responseText || 'No response from agent',
          },
        ],
      }
    }

    if (name === 'list_bedrock_agents') {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              agentId: AGENT_ID,
              agentAliasId: AGENT_ALIAS_ID,
              region: process.env.AWS_REGION || 'us-east-1',
            }, null, 2),
          },
        ],
      }
    }

    throw new Error(`Unknown tool: ${name}`)
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    }
  }
})

// List resources (optional)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'bedrock://agent',
        name: 'Bedrock Agent',
        description: 'Amazon Bedrock Agent',
        mimeType: 'application/json',
      },
    ],
  }
})

// Read resource (optional)
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params

  if (uri === 'bedrock://agent') {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            agentId: AGENT_ID,
            agentAliasId: AGENT_ALIAS_ID,
            region: process.env.AWS_REGION || 'us-east-1',
          }, null, 2),
        },
      ],
    }
  }

  throw new Error(`Unknown resource: ${uri}`)
})

// Start server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Bedrock MCP server running on stdio')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

