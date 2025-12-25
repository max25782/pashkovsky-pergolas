import { useState } from 'react'
import type { Lead } from '../lead-types'
import { updateLead, deleteLead } from '../lead-api'

interface UseLeadActionsParams {
  adminToken: string
  onUpdate?: (lead: Lead) => void
  onDelete?: (id: string) => void
  onError?: (error: Error) => void
}

export function useLeadActions({
  adminToken,
  onUpdate,
  onDelete,
  onError
}: UseLeadActionsParams) {
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function patch(id: string, updates: Partial<Lead>) {
    setUpdating(true)
    try {
      const updatedLead = await updateLead(id, updates, adminToken)
      onUpdate?.(updatedLead)
      return updatedLead
    } catch (e: any) {
      console.error('Patch error:', e)
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
      await deleteLead(id, adminToken)
      onDelete?.(id)
    } catch (e: any) {
      console.error('Delete error:', e)
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

