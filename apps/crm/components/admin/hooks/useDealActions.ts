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
      const { data, error } = await supabase
        .from('deals')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) {
        throw new Error(error.message)
      }
      
      console.log('[useDealActions] Updated deal:', data)
      onUpdate?.(data as Deal)
      return data as Deal
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
      
      // Get current user's company_id from company_members
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }
      
      const { data: membership } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .single()
      
      if (!membership?.company_id) {
        throw new Error('User not associated with a company')
      }
      
      // Create deal with company_id
      const { data, error } = await supabase
        .from('deals')
        .insert({
          ...dealData,
          company_id: membership.company_id
        })
        .select()
        .single()
      
      if (error) {
        throw new Error(error.message)
      }
      
      console.log('[useDealActions] Created deal:', data)
      onUpdate?.(data as Deal)
      return data as Deal
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
