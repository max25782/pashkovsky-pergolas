'use client'

import { useToast } from '@/components/ui/toast'
import { useState, useEffect, useRef } from 'react'
import { authFetch } from '@/lib/api/auth-fetch'
import { Brain, Send, Loader2, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Message {
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

export default function AIDirectorPage() {
  const t = useTranslations('aiDirector')
  const { error: toastError } = useToast()
  
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  
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
  
  async function sendMessage() {
    if (!input.trim() || loading) return
    
    setLoading(true)
    const userMessage = input.trim()
    setInput('')
    
    // Optimistic update
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    
    try {
      const res = await authFetch('/api/ai-director/chat', {
        method: 'POST',
        body: JSON.stringify({ message: userMessage, sessionId }),
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
      
      const data = await res.json()
      
      // Add AI response
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
      setSessionId(data.sessionId)
    } catch (error) {
      console.error('Error:', error)
      // Remove optimistic message on error
      setMessages(prev => prev.slice(0, -1))
      toastError(error instanceof Error ? error.message : t('error'))
    } finally {
      setLoading(false)
    }
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
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              {msg.created_at && (
                <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-lg px-4 py-3 shadow-sm border flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-gray-600">{t('loading')}</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <div className="bg-white border-t p-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t('placeholder')}
            className="flex-1 border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
            disabled={loading}
          />
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

