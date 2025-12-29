"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { Search, RefreshCw, MessageSquare, Trash2, X, User, Bot, Clock, ChevronLeft, Wifi, WifiOff } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { useCRMTranslations } from './useCRMTranslations'
import { authFetch } from '@/lib/api/auth-fetch'

interface Session {
  id: string
  client_id: string
  created_at: string
  last_activity: string
  message_count: number
  preview: string
}

interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

// Initialize Supabase client for realtime
// Use NEXT_PUBLIC_ versions if available, otherwise fallback to regular (for server-side)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

export function AIChatsTable() {
  const t = useCRMTranslations()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [total, setTotal] = useState(0)
  const [isRealtime, setIsRealtime] = useState(false)
  const supabaseRef = useRef<any>(null)
  
  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      
      const res = await authFetch(`/admin-api/ai-chats?${params}`)
      
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions || [])
        setTotal(data.total || 0)
      }
    } catch (e) {
      console.error('Failed to fetch sessions:', e)
    } finally {
      setLoading(false)
    }
  }, [search])
  
  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])
  
  // Setup realtime subscription
  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    supabaseRef.current = supabase
    
    // Subscribe to new messages
    const messagesChannel = supabase
      .channel('ai_messages_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_messages' },
        (payload: any) => {
          const newMessage = payload.new as Message
          
          // Update messages if viewing the same session
          if (selectedSession && newMessage.session_id === selectedSession.id) {
            setMessages(prev => [...prev, newMessage])
          }
          
          // Refresh sessions list to update counts
          fetchSessions()
        }
      )
      .subscribe((status: string) => {
        setIsRealtime(status === 'SUBSCRIBED')
      })
    
    // Subscribe to new sessions
    const sessionsChannel = supabase
      .channel('ai_sessions_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_sessions' },
        () => {
          fetchSessions()
        }
      )
      .subscribe()
    
    return () => {
      messagesChannel.unsubscribe()
      sessionsChannel.unsubscribe()
    }
  }, [selectedSession, fetchSessions])
  
  const fetchMessages = async (session: Session) => {
    setSelectedSession(session)
    setLoadingMessages(true)
    
    try {
      const res = await authFetch(`/admin-api/ai-chats?session_id=${session.id}`)
      
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch (e) {
      console.error('Failed to fetch messages:', e)
    } finally {
      setLoadingMessages(false)
    }
  }
  
  const deleteSession = async (sessionId: string) => {
    if (!confirm(t.aiChats.deleteDialog)) return
    
    try {
      const res = await authFetch(`/admin-api/ai-chats?session_id=${sessionId}`, {
        method: 'DELETE',
      })
      
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId))
        if (selectedSession?.id === sessionId) {
          setSelectedSession(null)
          setMessages([])
        }
      }
    } catch (e) {
      console.error('Failed to delete session:', e)
    }
  }
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffMins < 1) return 'сейчас'
    if (diffMins < 60) return `${diffMins} мин назад`
    if (diffHours < 24) return `${diffHours} ч назад`
    if (diffDays < 7) return `${diffDays} дн назад`
    return formatDate(dateStr)
  }
  
  return (
    <div className="flex h-[calc(100vh-150px)] gap-4">
      {/* Sessions List */}
      <div className={`${selectedSession ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-1/2 lg:w-2/5 bg-white/5 border border-white/10 rounded-xl overflow-hidden`}>
        {/* Search & Refresh */}
        <div className="p-4 border-b border-white/10 flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.aiChats.searchPlaceholder}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-black/40 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={fetchSessions}
            disabled={loading}
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-50"
            title={t.aiChats.refresh}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {/* Stats */}
        <div className="px-4 py-2 border-b border-white/10 text-sm text-white/60 flex items-center justify-between">
          <span>{t.aiChats.title}: {total}</span>
          <span className={`flex items-center gap-1 ${isRealtime ? 'text-green-400' : 'text-yellow-400'}`}>
            {isRealtime ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isRealtime ? t.aiChats.realtime : t.aiChats.realtimeOff}
          </span>
        </div>
        
        {/* Sessions */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-white/40 animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-white/40">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t.aiChats.noMessages}</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => fetchMessages(session)}
                className={`p-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${
                  selectedSession?.id === session.id ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-white/80 font-mono truncate">
                        {session.client_id.slice(0, 20)}...
                      </span>
                    </div>
                    <p className="text-sm text-white/60 truncate">{session.preview || t.aiChats.noMessages}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {session.message_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {getTimeAgo(session.last_activity)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSession(session.id)
                    }}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Messages Panel */}
      <div className={`${selectedSession ? 'flex' : 'hidden md:flex'} flex-col flex-1 bg-white/5 border border-white/10 rounded-xl overflow-hidden`}>
        {selectedSession ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center gap-3">
              <button
                onClick={() => setSelectedSession(null)}
                className="md:hidden p-2 rounded-lg hover:bg-white/10"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <div className="flex-1">
                <h3 className="font-semibold text-white">{t.aiChats.title}</h3>
                <p className="text-xs text-white/50 font-mono">{selectedSession.client_id}</p>
              </div>
              <div className="text-xs text-white/40">
                {formatDate(selectedSession.created_at)}
              </div>
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 text-white/40 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-white/40">
                  {t.aiChats.noMessages}
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                      msg.role === 'user' ? 'bg-blue-600' : 'bg-purple-600'
                    }`}>
                      {msg.role === 'user' ? (
                        <User className="w-4 h-4 text-white" />
                      ) : (
                        <Bot className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className={`max-w-[80%] rounded-xl px-4 py-2 ${
                      msg.role === 'user'
                        ? 'bg-blue-600/20 text-white'
                        : 'bg-white/10 text-white/90'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-xs text-white/40 mt-1">{formatTime(msg.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-white/40">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>{t.aiChats.preview}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

