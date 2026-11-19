import { buildBusinessSnapshot, clearSnapshotCache, readSnapshotCache, writeSnapshotCache } from '../business-snapshot'
import { takeSseEvents } from '../director-sse'
import { micErrorKind, readSpeechLang, speechSupported, writeSpeechLang } from '../speech-prefs'
import { parseChatMarkdown, softenStreamingMarkdown } from '../chat-markdown'
import { drainAgentCompletion } from '../drain-agent-completion'
import {
  AI_DIRECTOR_CLIENT_TIMEOUT_MS,
  AI_DIRECTOR_MAX_DURATION_SEC,
  DIRECTOR_RETRY_LABEL,
  DIRECTOR_TIMEOUT_MESSAGE,
  isDirectorTimeout,
} from '../director-timeout'

describe('AI Director timeouts', () => {
  it('waits 120 seconds in the browser and 300 seconds on the Hobby route', () => {
    expect(AI_DIRECTOR_CLIENT_TIMEOUT_MS).toBe(120_000)
    expect(AI_DIRECTOR_MAX_DURATION_SEC).toBe(300)
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

describe('business snapshot', () => {
  it('counts one company and leaves out phone numbers', () => {
    const text = buildBusinessSnapshot({
      now: new Date('2026-11-19T00:00:00Z'),
      deals: [
        { stage: 'done', price: 1000, projectType: 'pergola', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z' },
        { stage: 'offer', price: 500, projectType: 'glass', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
      ],
      leads: [{ source: 'facebook', status: 'new', createdAt: '2026-11-10T00:00:00Z' }],
      activeWorkers: 2,
      shiftsLast30Days: 4,
    })
    expect(text).toContain('done:1')
    expect(text).toContain('open 1')
    expect(text).not.toMatch(/05\d|phone|address/)
    expect(text.length).toBeLessThanOrEqual(4000)
  })

  it('expires the company cache after 10 minutes', () => {
    clearSnapshotCache()
    writeSnapshotCache('company-a', 'stages none', 0)
    expect(readSnapshotCache('company-a', 9 * 60 * 1000)).toBe('stages none')
    expect(readSnapshotCache('company-a', 11 * 60 * 1000)).toBeNull()
  })
})

describe('dictation preferences', () => {
  it('keeps the microphone language locally', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
    }
    writeSpeechLang(storage, 'ru-RU')
    expect(readSpeechLang(storage)).toBe('ru-RU')
    expect(speechSupported(false, true)).toBe('unsupported')
    expect(speechSupported(true, false)).toBe('insecure')
    expect(micErrorKind('not-allowed')).toBe('denied')
    expect(micErrorKind('network')).toBe('network')
    expect(micErrorKind('no-speech')).toBeNull()
  })

  it('keeps a partial SSE buffer until the event ends', () => {
    const first = takeSseEvents('event: delta\ndata: {"text":"שלום"}\n\nevent: status\n')
    expect(first.events).toEqual([{ event: 'delta', data: '{"text":"שלום"}' }])
    expect(first.rest).toContain('event: status')
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

  it('hides an unfinished bold marker while the answer is still streaming', () => {
    expect(softenStreamingMarkdown('סה״כ **פתוח')).toBe('סה״כ פתוח')
    expect(softenStreamingMarkdown('סה״כ **פתוח**')).toBe('סה״כ **פתוח**')
  })
})
