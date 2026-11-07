'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { matchReply, SUGGESTIONS, type BotReply } from '@/lib/new-site/chat-bot'
import { copy, t } from './i18n'
import { useNewSite } from './NewSiteProvider'

interface ChatMessage {
  id: number
  role: 'user' | 'bot'
  text: string
  reply?: BotReply
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])'

/**
 * Round AI button (bottom right) and its dialog. In /new this is a local keyword demo: the
 * real chat stores conversations in the CRM database, which a Preview deployment must not touch.
 */
export function AiChat() {
  const { lang, chatOpen, openChat, closeChat, reduceMotion } = useNewSite()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(1)
  const timers = useRef<number[]>([])

  // Focus the input on open, lock page scroll, give focus back to whatever opened the chat.
  useEffect(() => {
    if (!chatOpen) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    inputRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      opener?.focus({ preventScroll: true }) // a chat link may be navigating to an anchor right now
    }
  }, [chatOpen])

  // Escape closes the dialog and Tab stays inside it (modal focus trap).
  useEffect(() => {
    if (!chatOpen) return
    function onKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === 'Escape') {
        closeChat()
        return
      }
      if (event.key !== 'Tab') return
      const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        last.focus()
        event.preventDefault()
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus()
        event.preventDefault()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [chatOpen, closeChat])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((id) => window.clearTimeout(id))
  }, [])

  useEffect(() => {
    const log = logRef.current
    if (log !== null) log.scrollTop = log.scrollHeight
  }, [messages])

  function send(text: string): void {
    const clean = text.trim()
    if (clean === '') return
    setMessages((prev) => [...prev, { id: nextId.current++, role: 'user', text: clean }])
    setDraft('')
    const reply = matchReply(clean, lang)
    const timer = window.setTimeout(
      () => setMessages((prev) => [...prev, { id: nextId.current++, role: 'bot', text: reply.text, reply }]),
      reduceMotion ? 0 : 450,
    )
    timers.current.push(timer)
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    send(draft)
  }

  return (
    <>
      <div className="ns-fab ns-fab-r">
        <button type="button" className="ns-fab-ai" onClick={openChat} aria-label={t(copy.chat.open, lang)} aria-haspopup="dialog">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
            <path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-8l-5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm4 6.500a1.200 1.200 0 1 0 0 2.400 1.200 1.200 0 0 0 0-2.400zm4 0a1.200 1.200 0 1 0 0 2.400 1.200 1.200 0 0 0 0-2.400zm4 0a1.200 1.200 0 1 0 0 2.400 1.200 1.200 0 0 0 0-2.400z" />
          </svg>
        </button>
      </div>

      {chatOpen && (
        <div className="ns-chat">
          <div ref={dialogRef} className="ns-chat-box" role="dialog" aria-modal="true" aria-labelledby="ns-chat-title">
            <div className="ns-chat-h">
              <div>
                <b id="ns-chat-title">{t(copy.chat.title, lang)}</b>
                <small>{t(copy.chat.demo, lang)}</small>
              </div>
              <button type="button" className="ns-chat-x" onClick={closeChat} aria-label={t(copy.chat.close, lang)}>
                <span aria-hidden="true">{'\u2715'}</span>
              </button>
            </div>

            <div ref={logRef} className="ns-chat-log" role="log" aria-live="polite" aria-label={t(copy.chat.log, lang)}>
              <div className="ns-msg ns-bot">{t(copy.chat.welcome, lang)}</div>
              {messages.map((message) => (
                <div key={message.id} className={`ns-msg ${message.role === 'user' ? 'ns-user' : 'ns-bot'}`}>
                  {message.text}
                  {message.reply?.label !== undefined && (message.reply.go !== undefined || message.reply.href !== undefined) && (
                    <>
                      <br />
                      {message.reply.go !== undefined ? (
                        <a href={message.reply.go} onClick={closeChat}>
                          {message.reply.label}
                        </a>
                      ) : (
                        <a href={message.reply.href} target="_blank" rel="noopener noreferrer">
                          {message.reply.label}
                        </a>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="ns-chat-q">
              {SUGGESTIONS[lang].map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => send(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>

            <form className="ns-chat-f" onSubmit={onSubmit}>
              <label className="ns-sr" htmlFor="ns-chat-input">
                {t(copy.chat.inputLabel, lang)}
              </label>
              <input
                id="ns-chat-input"
                ref={inputRef}
                type="text"
                value={draft}
                maxLength={500}
                autoComplete="off"
                placeholder={t(copy.chat.input, lang)}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit" className="ns-btn ns-btn-a">
                {t(copy.chat.send, lang)}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
