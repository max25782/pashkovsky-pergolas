import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Deal } from '../deal-types'

interface UseDealActionsParams {
  onUpdate?: (deal: Deal) => void
  onDelete?: (id: string) => void
  onError?: (error: Error) => void
}

export function useDealActions({
  onUpdate,
  onDelete,
  onError
}: UseDealActionsParams = {}) {
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function patch(id: string, updates: Partial<Deal>) {
    setUpdating(true)
    try {
      console.log('[useDealActions] Updating deal:', id, updates)
      
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('User not authenticated')
      }
      
      const res = await fetch('/admin-api/deals', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id, ...updates }),
      })
      
      const responseText = await res.text()
      if (!res.ok) {
        let errorMessage = `Update failed: ${res.status}`
        try {
          const errorData = JSON.parse(responseText)
          errorMessage = errorData.error || errorData.message || errorMessage
        } catch {
          errorMessage = responseText || errorMessage
        }
        throw new Error(errorMessage)
      }
      
      const data = JSON.parse(responseText) as Deal
      console.log('[useDealActions] Updated deal:', data)
      onUpdate?.(data)
      return data
    } catch (e: any) {
      console.error('[useDealActions] Patch error:', e)
      const error = e instanceof Error ? e : new Error(String(e))
      onError?.(error)
      alert(`Ошибка обновления: ${error.message}`)
      throw error
    } finally {
      setUpdating(false)
    }
  }

  async function del(id: string) {
    if (!confirm('Удалить сделку?')) return
    
    setDeleting(true)
    try {
      console.log('[useDealActions] Deleting deal:', id)
      
      const supabase = createClient()
      const { error } = await supabase
        .from('deals')
        .delete()
        .eq('id', id)
      
      if (error) {
        throw new Error(error.message)
      }
      
      console.log('[useDealActions] Deleted deal:', id)
      onDelete?.(id)
      return true
    } catch (e: any) {
      console.error('[useDealActions] Delete error:', e)
      const error = e instanceof Error ? e : new Error(String(e))
      onError?.(error)
      alert(`Ошибка удаления: ${error.message}`)
      throw error
    } finally {
      setDeleting(false)
    }
  }

  async function create(dealData: Partial<Deal>) {
    setCreating(true)
    try {
      console.log('[useDealActions] Creating deal:', dealData)

      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('User not authenticated')
      }

      const res = await fetch('/admin-api/deals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(dealData),
      })

      const responseText = await res.text()
      if (!res.ok) {
        let errorMessage = `Create failed: ${res.status}`
        try {
          const errorData = JSON.parse(responseText)
          errorMessage = errorData.error || errorData.message || errorMessage
        } catch {
          errorMessage = responseText || errorMessage
        }
        throw new Error(errorMessage)
      }

      const data = JSON.parse(responseText) as Deal
      console.log('[useDealActions] Created deal:', data)
      onUpdate?.(data)
      return data
    } catch (e: any) {
      console.error('[useDealActions] Create error:', e)
      const error = e instanceof Error ? e : new Error(String(e))
      onError?.(error)
      alert(`Ошибка создания: ${error.message}`)
      throw error
    } finally {
      setCreating(false)
    }
  }

  return {
    create,
    patch,
    del,
    creating,
    updating,
    deleting
  }
}
