export interface ChatText {
  kind: 'text'
  value: string
}

export interface ChatBold {
  kind: 'bold'
  value: string
}

export type ChatInline = ChatText | ChatBold

export interface ChatParagraph {
  kind: 'paragraph'
  inlines: ChatInline[]
}

export interface ChatList {
  kind: 'list'
  items: ChatInline[][]
}

export type ChatBlock = ChatParagraph | ChatList

/** Bold spans and dash lists only. Anything else, including HTML, stays text. */
export function parseChatMarkdown(source: string): ChatBlock[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: ChatBlock[] = []
  let paragraph: string[] = []
  let list: string[] | null = null

  function flushParagraph(): void {
    const text = paragraph.join('\n').trim()
    paragraph = []
    if (text.length > 0) blocks.push({ kind: 'paragraph', inlines: parseInlines(text) })
  }

  function flushList(): void {
    if (list === null || list.length === 0) {
      list = null
      return
    }
    blocks.push({ kind: 'list', items: list.map((item) => parseInlines(item)) })
    list = null
  }

  for (const line of lines) {
    const item = /^[-*]\s+(.*)$/.exec(line)
    if (item) {
      flushParagraph()
      list = list ?? []
      list.push(item[1] ?? '')
      continue
    }
    if (line.trim() === '') {
      flushParagraph()
      flushList()
      continue
    }
    flushList()
    paragraph.push(line)
  }
  flushParagraph()
  flushList()
  return blocks
}

function parseInlines(text: string): ChatInline[] {
  const parts: ChatInline[] = []
  const pattern = /\*\*([^*]+)\*\*/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > last) parts.push({ kind: 'text', value: text.slice(last, index) })
    parts.push({ kind: 'bold', value: match[1] ?? '' })
    last = index + match[0].length
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) })
  return parts
}
