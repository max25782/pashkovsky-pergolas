import { parseChatMarkdown } from '../chat-markdown'
import { drainAgentCompletion } from '../drain-agent-completion'
import {
  AI_DIRECTOR_CLIENT_TIMEOUT_MS,
  AI_DIRECTOR_MAX_DURATION_SEC,
  DIRECTOR_RETRY_LABEL,
  DIRECTOR_TIMEOUT_MESSAGE,
  isDirectorTimeout,
} from '../director-timeout'

describe('AI Director timeouts', () => {
  it('waits 90 seconds in the browser and 60 seconds on the route', () => {
    expect(AI_DIRECTOR_CLIENT_TIMEOUT_MS).toBe(90_000)
    expect(AI_DIRECTOR_MAX_DURATION_SEC).toBe(60)
  })

  it('recognizes an abort without a reason and hides that text from the user', () => {
    const aborted = new DOMException('signal is aborted without reason', 'AbortError')
    expect(isDirectorTimeout(aborted)).toBe(true)
    expect(isDirectorTimeout(new DOMException('Request timed out after 90000ms', 'TimeoutError'))).toBe(true)
    expect(isDirectorTimeout(new Error('Bedrock InvokeAgent failed'))).toBe(false)
    expect(DIRECTOR_TIMEOUT_MESSAGE).not.toMatch(/abort|signal/i)
    expect(DIRECTOR_RETRY_LABEL).toBe('נסו שוב')
  })
})

describe('agent completion stream', () => {
  it('does not finish until the last chunk arrives', async () => {
    let releaseSecondChunk: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      releaseSecondChunk = resolve
    })
    let started = false

    async function* stream() {
      started = true
      yield { chunk: { bytes: new TextEncoder().encode('Hello') } }
      await gate
      yield { chunk: { bytes: new TextEncoder().encode(' there') } }
    }

    const pending = drainAgentCompletion(stream())
    let settled = false
    const finished = pending.then((result) => {
      settled = true
      return result
    })

    await Promise.resolve()
    expect(started).toBe(true)
    expect(settled).toBe(false)

    releaseSecondChunk()
    await expect(finished).resolves.toEqual({ text: 'Hello there', returnControl: null })
  })

  it('keeps a tool request that arrives after the first text chunk', async () => {
    async function* stream() {
      yield { chunk: { bytes: new TextEncoder().encode('Looking') } }
      yield { returnControl: { invocationId: 'call-1', invocationInputs: [] } }
    }

    await expect(drainAgentCompletion(stream())).resolves.toEqual({
      text: 'Looking',
      returnControl: { invocationId: 'call-1', invocationInputs: [] },
    })
  })
})

describe('chat markdown', () => {
  it('turns bold and dash lists into text nodes, and leaves HTML as text', () => {
    const blocks = parseChatMarkdown('**Deals**\n\n- open deals\n- **closed** deals\n\n<script>alert(1)</script>')

    expect(blocks).toEqual([
      { kind: 'paragraph', inlines: [{ kind: 'bold', value: 'Deals' }] },
      {
        kind: 'list',
        items: [
          [{ kind: 'text', value: 'open deals' }],
          [
            { kind: 'bold', value: 'closed' },
            { kind: 'text', value: ' deals' },
          ],
        ],
      },
      { kind: 'paragraph', inlines: [{ kind: 'text', value: '<script>alert(1)</script>' }] },
    ])
  })
})
