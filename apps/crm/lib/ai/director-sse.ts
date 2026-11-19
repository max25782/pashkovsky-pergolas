export interface SseEvent {
  event: string
  data: string
}

export function takeSseEvents(buffer: string): { events: SseEvent[]; rest: string } {
  const parts = buffer.split('\n\n')
  const rest = parts.pop() ?? ''
  const events: SseEvent[] = []
  for (const part of parts) {
    let event = 'message'
    const dataLines: string[] = []
    for (const line of part.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
    }
    if (dataLines.length > 0) events.push({ event, data: dataLines.join('\n') })
  }
  return { events, rest }
}
