export interface AgentCompletionChunk {
  chunk?: { bytes?: Uint8Array }
  returnControl?: {
    invocationId?: string
    invocationInputs?: unknown[]
  }
}

export interface DrainedAgentCompletion {
  text: string
  returnControl: AgentCompletionChunk['returnControl'] | null
}

/** Reads every chunk. The caller must not answer before this promise settles. */
export async function drainAgentCompletion(
  completion: AsyncIterable<AgentCompletionChunk> | undefined,
): Promise<DrainedAgentCompletion> {
  let text = ''
  let returnControl: DrainedAgentCompletion['returnControl'] = null
  if (!completion) return { text, returnControl }
  for await (const event of completion) {
    if (event.chunk?.bytes) text += new TextDecoder().decode(event.chunk.bytes)
    if (event.returnControl) returnControl = event.returnControl
  }
  return { text, returnControl }
}
