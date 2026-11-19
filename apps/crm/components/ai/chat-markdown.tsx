import { parseChatMarkdown, type ChatInline } from '@/lib/ai/chat-markdown'

function Inlines({ parts }: { parts: ChatInline[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.kind === 'bold' ? <strong key={index}>{part.value}</strong> : <span key={index}>{part.value}</span>,
      )}
    </>
  )
}

export function ChatMarkdown({ text }: { text: string }) {
  const blocks = parseChatMarkdown(text)
  return (
    <div dir="auto" className="space-y-2 break-words text-start">
      {blocks.map((block, index) =>
        block.kind === 'list' ? (
          <ul key={index} className="list-disc space-y-1 ps-5">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Inlines parts={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={index} className="whitespace-pre-wrap">
            <Inlines parts={block.inlines} />
          </p>
        ),
      )}
    </div>
  )
}
