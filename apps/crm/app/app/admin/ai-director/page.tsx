'use client'

import { ChatMarkdown } from '@/components/ai/chat-markdown'
import { softenStreamingMarkdown } from '@/lib/ai/chat-markdown'
import { useToast } from '@/components/ui/toast'
import { useState, useEffect, useRef } from 'react'
import { authFetch } from '@/lib/api/auth-fetch'
import { takeSseEvents } from '@/lib/ai/director-sse'
import {
  AI_DIRECTOR_CLIENT_TIMEOUT_MS,
  DIRECTOR_RETRY_LABEL,
  DIRECTOR_TIMEOUT_MESSAGE,
  isDirectorTimeout,
} from '@/lib/ai/director-timeout'
import { micErrorKind, readSpeechLang, speechHost, speechSupported, writeSpeechLang, type MicHint, type SpeechLang } from '@/lib/ai/speech-prefs'
import { Brain, Loader2, Mic, Send, Sparkles, Square } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Message {
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

interface BrowserRecognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

export default function AIDirectorPage() {
  const t = useTranslations('aiDirector')
  const { error: toastError } = useToast()
  
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [retryMessage, setRetryMessage] = useState<string | null>(null)
  const [showTimeout, setShowTimeout] = useState(false)
  const [phase, setPhase] = useState<'thinking' | 'crm' | null>(null)
  const [speechLang, setSpeechLang] = useState<SpeechLang>('he-IL')
  const [sendOnPause, setSendOnPause] = useState(false)
  const [speechHint, setSpeechHint] = useState<MicHint | null>(null)
  const [listening, setListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const abortRef = useRef<AbortController | null>(null)
  const stoppedRef = useRef(false)
  const revealRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognitionRef = useRef<BrowserRecognition | null>(null)
  const sendOnPauseRef = useRef(false)
  const dictationBaseRef = useRef('')
  const [streamingAssistant, setStreamingAssistant] = useState(false)

  function onListScroll() {
    const el = listRef.current
    if (!el) return
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  // Auto-scroll only while the user stays near the bottom
  useEffect(() => {
    if (!stickToBottomRef.current) return
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, phase, streamingAssistant])

  useEffect(() => {
    setSpeechLang(readSpeechLang(typeof window === 'undefined' ? null : window.localStorage))
    return () => {
      try {
        recognitionRef.current?.stop()
      } catch {
        // The page is going away.
      }
      recognitionRef.current = null
    }
  }, [])
  
  // Load history on mount
  useEffect(() => {
    loadHistory()
  }, [])
  
  async function loadHistory() {
    try {
      const res = await authFetch('/api/ai-director/chat')
      
      if (!res.ok) {
        // If 401/403, user might not be authenticated - that's OK, just start fresh
        if (res.status === 401 || res.status === 403) {
          console.warn('[AI Director] Not authenticated, starting fresh session')
          setMessages([])
          return
        }
        
        const errorText = await res.text()
        console.error('[AI Director] Error loading history:', res.status, errorText)
        return
      }
      
      const data = await res.json()
      setMessages(data.messages || [])
      
      // Set sessionId if provided
      if (data.sessionId) {
        setSessionId(data.sessionId)
      }
    } catch (error) {
      console.error('Error loading history:', error)
      // Don't show error to user - just start with empty messages
      setMessages([])
    }
  }
  
  async function submit(text: string) {
    const userMessage = text.trim()
    if (!userMessage || loading) return

    setShowTimeout(false)
    stoppedRef.current = false
    stickToBottomRef.current = true
    setStreamingAssistant(false)
    const abort = new AbortController()
    abortRef.current = abort
    setLoading(true)
    setPhase('thinking')
    setInput('')

    // Optimistic update
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])

    try {
      const res = await authFetch('/api/ai-director/chat', {
        method: 'POST',
        body: JSON.stringify({ message: userMessage, sessionId }),
        timeoutMs: AI_DIRECTOR_CLIENT_TIMEOUT_MS,
        signal: abort.signal,
      })
      
      if (!res.ok) {
        const text = await res.text()
        let json: any
        try {
          json = JSON.parse(text)
        } catch {
          json = null
        }
        
        // Check if it's a subscription/upgrade error
        if (res.status === 403 && json?.upgrade_required) {
          const upgradeMessage = json.message || 'AI Director доступен только для планов Pro и Enterprise'
          const currentPlan = json.current_plan ? `\n\nТекущий план: ${json.current_plan}` : ''
          const upgradeHint = '\n\nПерейдите в настройки подписки для обновления плана.'
          throw new Error(`${upgradeMessage}${currentPlan}${upgradeHint}`)
        }
        
        const message = json?.error || t('error')
        const hint = json?.hint ? `\n\n${json.hint}` : ''
        const checkedUrl = json?.checkedUrl ? `\n\nChecked: ${json.checkedUrl}` : ''
        throw new Error(`${message}${hint}${checkedUrl}`)
      }
      
      if (!res.body) throw new Error('empty')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let pending = ''
      let answer = ''
      let typewriter = false
      let sawDelta = false
      const applyAnswer = (next: string) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant') return [...prev.slice(0, -1), { ...last, content: next }]
          return [...prev, { role: 'assistant', content: next }]
        })
      }
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        pending += decoder.decode(chunk.value, { stream: true })
        const parsed = takeSseEvents(pending)
        pending = parsed.rest
        for (const event of parsed.events) {
          const payload = JSON.parse(event.data) as { phase?: 'thinking' | 'crm'; text?: string; sessionId?: string; typewriter?: boolean; code?: string }
          if (event.event === 'status' && (payload.phase === 'thinking' || payload.phase === 'crm')) setPhase(payload.phase)
          if (event.event === 'delta' && payload.text) {
            sawDelta = true
            setStreamingAssistant(true)
            setPhase(null)
            answer += payload.text
            applyAnswer(softenStreamingMarkdown(answer))
          }
          if (event.event === 'done') {
            typewriter = payload.typewriter === true
            if (payload.sessionId) setSessionId(payload.sessionId)
            if (!typewriter) applyAnswer(answer)
          }
          if (event.event === 'error') throw new Error('המנהל לא הצליח לענות. נסו שוב.')
        }
      }
      setRetryMessage(null)
      setPhase(null)
      if (typewriter && sawDelta) {
        setStreamingAssistant(true)
        reveal(answer, applyAnswer, () => setStreamingAssistant(false))
      } else {
        setStreamingAssistant(false)
      }
    } catch (error) {
      if (stoppedRef.current) return
      console.error('Error:', error)
      await loadHistory()
      if (isDirectorTimeout(error)) {
        setRetryMessage(userMessage)
        setShowTimeout(true)
        return
      }
      setRetryMessage(null)
      toastError(error instanceof Error ? error.message : t('error'))
    } finally {
      setLoading(false)
      setPhase(null)
      abortRef.current = null
    }
  }

  function reveal(full: string, apply: (next: string) => void, onDone?: () => void) {
    if (revealRef.current) clearInterval(revealRef.current)
    let shown = 0
    apply('')
    revealRef.current = setInterval(() => {
      shown = Math.min(full.length, shown + 3)
      apply(full.slice(0, shown))
      if (shown >= full.length && revealRef.current) {
        clearInterval(revealRef.current)
        revealRef.current = null
        onDone?.()
      }
    }, 16)
  }

  function stopGeneration() {
    stoppedRef.current = true
    abortRef.current?.abort()
    if (revealRef.current) {
      clearInterval(revealRef.current)
      revealRef.current = null
    }
    setLoading(false)
    setPhase(null)
    setStreamingAssistant(false)
  }

  function stopMic() {
    const current = recognitionRef.current
    if (current) current.continuous = false
    recognitionRef.current = null
    setListening(false)
    try {
      current?.stop()
    } catch {
      // The engine already stopped.
    }
  }

  function startMic() {
    if (recognitionRef.current) {
      stopMic()
      return
    }
    if (typeof window === 'undefined') return
    const secure = window.isSecureContext
    const browserWindow = window as Window & {
      SpeechRecognition?: new () => BrowserRecognition
      webkitSpeechRecognition?: new () => BrowserRecognition
    }
    const recognitionCtor = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition
    const support = speechSupported(Boolean(recognitionCtor), secure)
    if (speechHost(navigator.userAgent) === 'embedded') {
      setSpeechHint('embedded')
      return
    }
    if (support === 'insecure') {
      setSpeechHint('https')
      return
    }
    if (support === 'unsupported' || !recognitionCtor) {
      setSpeechHint('browser')
      return
    }
    const recognition = new recognitionCtor()
    recognition.lang = speechLang
    recognition.interimResults = true
    recognition.continuous = true
    const session = { stopRequested: false, fatal: false, askedForMic: false, wantsPermission: false }
    dictationBaseRef.current = input
    sendOnPauseRef.current = sendOnPause
    let pauseTimer = 0
    const writeTranscript = (event: Parameters<NonNullable<BrowserRecognition['onresult']>>[0]) => {
      let finalText = ''
      let interim = ''
      for (let index = 0; index < event.results.length; index += 1) {
        const piece = event.results[index]?.[0]?.transcript ?? ''
        if (event.results[index]?.isFinal) finalText += `${piece} `
        else interim += piece
      }
      const next = `${dictationBaseRef.current} ${finalText}${interim}`.replace(/\s+/g, ' ').trim()
      setInput(next)
      if (!sendOnPauseRef.current || !finalText.trim()) return
      window.clearTimeout(pauseTimer)
      pauseTimer = window.setTimeout(() => {
        session.stopRequested = true
        stopMic()
        if (next) void submit(next)
      }, 1400)
    }
    recognition.onresult = writeTranscript
    recognition.onerror = (event) => {
      const kind = micErrorKind(event.error)
      if (event.error === 'not-allowed' && !session.askedForMic && typeof navigator.mediaDevices?.getUserMedia === 'function') {
        session.askedForMic = true
        session.wantsPermission = true
        return
      }
      if (!kind) return
      session.fatal = true
      if (recognitionRef.current === recognition) recognitionRef.current = null
      setSpeechHint(kind)
      setListening(false)
    }
    recognition.onend = () => {
      window.clearTimeout(pauseTimer)
      if (session.wantsPermission && !session.stopRequested && recognitionRef.current === recognition) {
        session.wantsPermission = false
        void navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          stream.getTracks().forEach((track) => track.stop())
          if (session.stopRequested || recognitionRef.current !== recognition) return
          try {
            recognition.start()
          } catch {
            session.fatal = true
            if (recognitionRef.current === recognition) recognitionRef.current = null
            setSpeechHint('denied')
            setListening(false)
          }
        }).catch(() => {
          session.fatal = true
          if (recognitionRef.current === recognition) recognitionRef.current = null
          setSpeechHint('denied')
          setListening(false)
        })
        return
      }
      if (session.stopRequested || session.fatal || recognitionRef.current !== recognition) {
        if (recognitionRef.current === recognition) recognitionRef.current = null
        setListening(false)
        return
      }
      window.setTimeout(() => {
        if (session.stopRequested || session.fatal || recognitionRef.current !== recognition) return
        try {
          recognition.start()
        } catch (error) {
          const message = error instanceof Error ? error.message : ''
          if (/already started/i.test(message)) return
          setListening(false)
          recognitionRef.current = null
        }
      }, 250)
    }
    recognitionRef.current = recognition
    setListening(true)
    setSpeechHint(null)
    try {
      recognition.start()
    } catch {
      recognitionRef.current = null
      setListening(false)
      setSpeechHint('browser')
    }
  }

  function sendMessage() {
    void submit(input)
  }

  function retryLast() {
    if (!retryMessage) return
    void submit(retryMessage)
  }
  
  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }
  
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center gap-3 shadow-sm">
        <div className="relative">
          <Brain className="w-10 h-10 text-blue-600" />
          <Sparkles className="w-4 h-4 text-yellow-500 absolute -top-1 -right-1" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-600">{t('subtitle')}</p>
        </div>
      </header>
      
      {/* Messages */}
      <div ref={listRef} onScroll={onListScroll} className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-12">
            <div className="relative inline-block">
              <Brain className="w-20 h-20 mx-auto mb-4 text-gray-300" />
              <Sparkles className="w-6 h-6 text-yellow-400 absolute top-0 right-0" />
            </div>
            <p className="text-lg font-medium mb-2">{t('emptyState')}</p>
            <p className="text-sm mt-4 mb-2 font-semibold">{t('examples.title')}</p>
            <ul className="text-sm mt-2 space-y-2 max-w-md mx-auto text-left">
              <li className="bg-white p-3 rounded-lg shadow-sm border">
                💼 &ldquo;{t('examples.deals')}&rdquo;
              </li>
              <li className="bg-white p-3 rounded-lg shadow-sm border">
                📊 &ldquo;{t('examples.conversion')}&rdquo;
              </li>
              <li className="bg-white p-3 rounded-lg shadow-sm border">
                ⚠️ &ldquo;{t('examples.attention')}&rdquo;
              </li>
              <li className="bg-white p-3 rounded-lg shadow-sm border">
                👷 &ldquo;{t('examples.workers')}&rdquo;
              </li>
            </ul>
          </div>
        )}
        
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-lg px-4 py-3 ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-900 shadow-sm border'
            }`}>
              {msg.role === 'assistant' ? (
                <ChatMarkdown
                  text={msg.content}
                  streaming={streamingAssistant && i === messages.length - 1}
                />
              ) : (
                <div dir="auto" className="whitespace-pre-wrap break-words text-start">{msg.content}</div>
              )}
              {msg.created_at && (
                <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {loading && !streamingAssistant && (
          <div className="flex justify-start">
            <div className="bg-white rounded-lg px-4 py-3 shadow-sm border flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-gray-600">{phase === 'crm' ? 'מקבל נתונים מה-CRM…' : 'חושב…'}</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <div className="bg-white border-t p-4 shadow-lg">
        {showTimeout ? (
          <div className="max-w-4xl mx-auto mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p>{DIRECTOR_TIMEOUT_MESSAGE}</p>
            <button
              type="button"
              onClick={retryLast}
              disabled={loading || !retryMessage}
              className="rounded-lg bg-amber-700 px-4 py-2 text-white hover:bg-amber-800 disabled:opacity-50"
            >
              {DIRECTOR_RETRY_LABEL}
            </button>
          </div>
        ) : null}
        <div className="max-w-4xl mx-auto mb-2 flex flex-wrap items-center gap-3 text-xs text-gray-600">
          <label className="flex items-center gap-1">
            שפה
            <select
              value={speechLang}
              onChange={(event) => {
                const next = event.target.value as SpeechLang
                setSpeechLang(next)
                writeSpeechLang(window.localStorage, next)
              }}
              className="rounded border px-2 py-1"
            >
              <option value="he-IL">עברית</option>
              <option value="ru-RU">Русский</option>
              <option value="en-US">English</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={sendOnPause} onChange={(event) => setSendOnPause(event.target.checked)} />
            שליחה בהפסקה
          </label>
        </div>
        {speechHint === 'https' ? <p className="max-w-4xl mx-auto mb-2 text-sm text-amber-800">המיקרופון זמין רק בחיבור מאובטח (HTTPS).</p> : null}
        {speechHint === 'browser' ? <p className="max-w-4xl mx-auto mb-2 text-sm text-amber-800">הדפדפן הזה לא תומך בזיהוי דיבור. פתחו את העמוד ב-Chrome או ב-Safari.</p> : null}
        {speechHint === 'embedded' ? <p className="max-w-4xl mx-auto mb-2 text-sm text-amber-800">חלון Cursor לא מפעיל את המיקרופון. פתחו את אותו עמוד ב-Chrome או ב-Safari.</p> : null}
        {speechHint === 'denied' ? <p className="max-w-4xl mx-auto mb-2 text-sm text-amber-800">הגישה למיקרופון נדחתה. אשרו אותה בדפדפן ובהגדרות המערכת.</p> : null}
        {speechHint === 'no-device' ? <p className="max-w-4xl mx-auto mb-2 text-sm text-amber-800">לא נמצא מיקרופון.</p> : null}
        {speechHint === 'network' ? <p className="max-w-4xl mx-auto mb-2 text-sm text-amber-800">שירות הזיהוי של הדפדפן לא ענה. נסו Chrome.</p> : null}
        <div className="max-w-4xl mx-auto flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t('placeholder')}
            dir="auto"
            className="flex-1 border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
            disabled={loading}
          />
          <button
            type="button"
            onClick={startMic}
            aria-pressed={listening}
            aria-label={listening ? 'stop microphone' : 'microphone'}
            className={`flex items-center gap-2 rounded-lg border px-3 py-3 ${listening ? 'border-red-500 bg-red-50 text-red-700' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            <Mic className={`h-5 w-5 ${listening ? 'animate-pulse' : ''}`} />
            <span className="text-sm">{listening ? 'מאזין…' : 'מיקרופון'}</span>
          </button>
          {loading ? (
            <button
              type="button"
              onClick={stopGeneration}
              className="rounded-lg bg-zinc-800 px-4 py-3 text-white"
            >
              <Square className="h-5 w-5" />
              <span className="sr-only">עצור</span>
            </button>
          ) : null}
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            <span className="hidden sm:inline">{t('send')}</span>
          </button>
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">
          {t('footer')}
        </p>
      </div>
    </div>
  )
}

