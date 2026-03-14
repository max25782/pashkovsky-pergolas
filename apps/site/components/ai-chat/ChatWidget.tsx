"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import { useToast } from '@/components/ui/toast'
import { MessageCircle, X, Send, Loader2, Bot, User, AlertCircle, Plus, Image as ImageIcon, XCircle } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  imageUrl?: string
  imageUrls?: string[]
  created_at?: string
}

export function ChatWidget() {
  const toast = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  useEffect(() => {
    let id = localStorage.getItem('pashkovsky_ai_client_id')
    if (!id) {
      id = `client_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
      localStorage.setItem('pashkovsky_ai_client_id', id)
    }
    setClientId(id)
  }, [])
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])
  
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])
  
  useEffect(() => {
    if (isOpen && !isInitialized && clientId) {
      loadHistory()
    }
  }, [isOpen, isInitialized, clientId])
  
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])
  
  const loadHistory = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_CRM_API_URL || 'https://crm.pashkovsky-group.com'
      const siteToken = process.env.NEXT_PUBLIC_CRM_SITE_TOKEN
      
      const res = await fetch(`${apiUrl}/api/public/ai-chat?clientId=${clientId}`, {
        headers: {
          'x-site-token': siteToken || '',
        },
      })
      
      if (res.ok) {
        const data = await res.json()
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages)
        }
      }
    } catch (e) {
      console.error('Failed to load history:', e)
    } finally {
      setIsInitialized(true)
    }
  }
  
  const startNewChat = () => {
    if (confirm('להתחיל צ\'אט חדש? ההודעות הנוכחיות ייעלמו מהמסך.')) {
      setMessages([])
      setError(null)
      setRemaining(null)
      setIsInitialized(true)
    }
  }
  
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!file.type.startsWith('image/')) {
      toast.error('אנא בחר קובץ תמונה')
      return
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error('הקובץ גדול מדי. מקסימום 10MB')
      return
    }
    
    const reader = new FileReader()
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string)
      setImageFile(file)
    }
    reader.readAsDataURL(file)
  }
  
  const removeImage = () => {
    setSelectedImage(null)
    setImageFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  
  const sendMessage = async () => {
    if ((!input.trim() && !selectedImage) || isLoading || isStreaming || !clientId) return
    
    const userMessage = input.trim()
    const imageData = selectedImage
    setInput('')
    setError(null)
    setIsLoading(true)
    
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage || (imageData ? 'תמונה' : ''),
      imageUrl: imageData || undefined
    }])
    
    const imageToSend = imageData
    const fileToSend = imageFile
    removeImage()
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_CRM_API_URL || 'https://crm.pashkovsky-group.com'
      const siteToken = process.env.NEXT_PUBLIC_CRM_SITE_TOKEN
      
      const formData = new FormData()
      formData.append('message', userMessage || '')
      formData.append('clientId', clientId)
      if (fileToSend && imageToSend) {
        formData.append('image', fileToSend)
      }
      
      const res = await fetch(`${apiUrl}/api/public/ai-chat`, {
        method: 'POST',
        headers: {
          'x-site-token': siteToken || '',
        },
        body: formData,
      })
      
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'הגעת למגבלת ההודעות. נסה שוב מאוחר יותר.')
        setIsLoading(false)
        return
      }
      
      if (!res.ok) {
        let errorMessage = 'שגיאה בשליחת ההודעה'
        try {
          const data = await res.json()
          errorMessage = data.error || errorMessage
        } catch {
          errorMessage = `שגיאת שרת (${res.status})`
        }
        setError(errorMessage)
        setIsLoading(false)
        return
      }
      
      setIsLoading(false)
      setIsStreaming(true)
      
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])
      
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No reader')
      
      const decoder = new TextDecoder()
      let buffer = ''
      
      try {
        while (true) {
          const { done, value } = await reader.read()
          
          if (done) break
          
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                
                if (data.error) {
                  setError(data.error)
                  setIsStreaming(false)
                  return
                }
                
                if (data.text) {
                  setMessages(prev => {
                    const newMessages = [...prev]
                    const lastMessage = newMessages[newMessages.length - 1]
                    if (lastMessage && lastMessage.role === 'assistant') {
                      lastMessage.content += data.text
                    }
                    return newMessages
                  })
                }
                
                if (data.images && Array.isArray(data.images)) {
                  setMessages(prev => {
                    const newMessages = [...prev]
                    const lastMessage = newMessages[newMessages.length - 1]
                    if (lastMessage && lastMessage.role === 'assistant') {
                      lastMessage.imageUrls = data.images
                    }
                    return newMessages
                  })
                }
                
                if (data.done) {
                  if (typeof data.remaining === 'number') {
                    setRemaining(data.remaining)
                  }
                }
              } catch (e) {
                console.warn('Failed to parse JSON:', line.substring(0, 100))
              }
            }
          }
        }
      } catch (streamError: any) {
        setError(`שגיאה בקריאת התגובה: ${streamError?.message || 'Unknown error'}`)
        setIsStreaming(false)
        return
      }
      
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : String(e)) || 'שגיאה בשליחת ההודעה. נסה שוב.')
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
    }
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }
  
  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-24 left-4 sm:bottom-6 sm:left-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 flex items-center justify-center ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
        aria-label="פתח צ'אט"
      >
        <MessageCircle className="w-6 h-6" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-pulse" />
      </button>
      
      {/* Chat Window */}
      <div
        className={`fixed bottom-0 left-0 sm:bottom-6 sm:left-6 z-50 w-full sm:w-[400px] h-[100dvh] sm:h-[600px] sm:max-h-[80vh] bg-gray-900 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full sm:translate-y-8 opacity-0 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">Pashkovsky AI</h3>
              <p className="text-xs text-white/80">מומחה לפרגולות ומעקות</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={startNewChat}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                aria-label="צ'אט חדש"
                title="צ'אט חדש"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              aria-label="סגור צ'אט"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-800/50">
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                <Bot className="w-8 h-8 text-blue-400" />
              </div>
              <h4 className="text-white font-semibold mb-2">שלום! 👋</h4>
              <p className="text-gray-400 text-sm">
                אני כאן לעזור לך לבחור את הפרגולה המושלמת.
                <br />
                שאל אותי כל שאלה!
              </p>
            </div>
          )}
          
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                msg.role === 'user' 
                  ? 'bg-blue-600' 
                  : 'bg-gradient-to-br from-purple-500 to-blue-500'
              }`}>
                {msg.role === 'user' ? (
                  <User className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-white" />
                )}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-sm'
                  : 'bg-gray-700 text-gray-100 rounded-tl-sm'
              }`}>
                {msg.imageUrl && (
                  <div className="mb-2 rounded-lg overflow-hidden">
                    <img 
                      src={msg.imageUrl} 
                      alt="Uploaded" 
                      className="max-w-full h-auto max-h-64 object-contain rounded"
                    />
                  </div>
                )}
                {msg.imageUrls && msg.imageUrls.length > 0 && (
                  <div className="mb-2 grid grid-cols-1 gap-2">
                    {msg.imageUrls.map((url, idx) => (
                      <div key={idx} className="rounded-lg overflow-hidden">
                        <img 
                          src={url} 
                          alt={`Pergola example ${idx + 1}`}
                          className="max-w-full h-auto max-h-64 object-contain rounded"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {msg.content && (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {msg.content.replace(/\[IMAGE:[^\]]*\]/g, '').trim()}
                  </p>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-700 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          {error && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Rate limit indicator */}
        {remaining !== null && remaining <= 5 && (
          <div className="px-4 py-1 bg-yellow-500/20 text-yellow-300 text-xs text-center">
            נותרו {remaining} הודעות בשעה הקרובה
          </div>
        )}
        
        {/* Input */}
        <div className="p-4 bg-gray-900 border-t border-gray-700">
          {selectedImage && (
            <div className="mb-2 relative inline-block">
              <div className="relative">
                <img 
                  src={selectedImage} 
                  alt="Preview" 
                  className="max-w-[200px] max-h-[150px] object-contain rounded-lg border border-gray-600"
                />
                <button
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors"
                  aria-label="הסר תמונה"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isStreaming}
              className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 flex items-center justify-center transition-colors disabled:opacity-50"
              aria-label="הוסף תמונה"
              title="הוסף תמונה"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="כתוב הודעה..."
              disabled={isLoading || isStreaming}
              className="flex-1 px-4 py-3 rounded-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
              dir="auto"
            />
            <button
              onClick={sendMessage}
              disabled={(!input.trim() && !selectedImage) || isLoading || isStreaming}
              className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="שלח"
            >
              {isLoading || isStreaming ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

