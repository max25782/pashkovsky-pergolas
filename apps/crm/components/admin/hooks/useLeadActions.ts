import { useState } from 'react'
import type { Lead } from '../lead-types'
import { createAuthenticatedClient } from '@/lib/supabase/client'

interface UseLeadActionsParams {
  onUpdate?: (lead: Lead) => void
  onDelete?: (id: string) => void
  onError?: (error: Error) => void
}

export function useLeadActions({
  onUpdate,
  onDelete,
  onError
}: UseLeadActionsParams) {
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function patch(id: string, updates: Partial<Lead>) {
    setUpdating(true)
    try {
      const supabase = createAuthenticatedClient()
      
      const { data, error: dbError } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (dbError) throw new Error(dbError.message)
      
      onUpdate?.(data as Lead)
      return data as Lead
    } catch (e: any) {
      console.error('[useLeadActions] Patch error:', e)
      const error = e instanceof Error ? e : new Error(String(e))
      onError?.(error)
      alert(`Ошибка обновления: ${error.message}`)
      throw error
    } finally {
      setUpdating(false)
    }
  }

  async function del(id: string) {
    if (!confirm('Удалить лид?')) return
    
    setDeleting(true)
    try {
      const supabase = createAuthenticatedClient()
      
      const { error: dbError } = await supabase
        .from('leads')
        .delete()
        .eq('id', id)
      
      if (dbError) throw new Error(dbError.message)
      
      onDelete?.(id)
    } catch (e: any) {
      console.error('[useLeadActions] Delete error:', e)
      const error = e instanceof Error ? e : new Error(String(e))
      onError?.(error)
      alert(`Ошибка удаления: ${error.message}`)
      throw error
    } finally {
      setDeleting(false)
    }
  }

  return {
    patch,
    del,
    updating,
    deleting
  }
}

