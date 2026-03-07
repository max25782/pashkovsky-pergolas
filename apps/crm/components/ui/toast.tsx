'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastProps {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium pointer-events-auto transition-all ${
            toast.type === 'success'
              ? 'bg-green-900/90 border-green-500/40 text-green-200'
              : toast.type === 'error'
              ? 'bg-red-900/90 border-red-500/40 text-red-200'
              : 'bg-blue-900/90 border-blue-500/40 text-blue-200'
          }`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function useToast(autoDismissMs = 4000) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = timers.current.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts(prev => [...prev, { id, message, type }])
    const timer = setTimeout(() => dismiss(id), autoDismissMs)
    timers.current.set(id, timer)
  }, [autoDismissMs, dismiss])

  useEffect(() => {
    const current = timers.current
    return () => { current.forEach(t => clearTimeout(t)); current.clear() }
  }, [])

  return { toasts, show, dismiss }
}
