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

/** Reads every chunk before resolving. onText runs as each text piece arrives. */
export async function drainAgentCompletion(
  completion: AsyncIterable<AgentCompletionChunk> | undefined,
  onText?: (piece: string) => void,
): Promise<DrainedAgentCompletion> {
  let text = ''
  let returnControl: DrainedAgentCompletion['returnControl'] = null
  if (!completion) return { text, returnControl }
  for await (const event of completion) {
    if (event.chunk?.bytes) {
      const piece = new TextDecoder().decode(event.chunk.bytes)
      text += piece
      if (piece) onText?.(piece)
    }
    if (event.returnControl) returnControl = event.returnControl
  }
  return { text, returnControl }
}
