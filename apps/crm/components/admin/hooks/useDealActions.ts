import { useState } from 'react'
import { authFetch, getAuthHeaders } from '@/lib/api/auth-fetch'
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
      const authHeaders = await getAuthHeaders()
      if (!authHeaders.Authorization) {
        throw new Error('User not authenticated')
      }

      const res = await authFetch('/admin-api/deals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
      onUpdate?.(data)
      return data
    } catch (e) {
      console.error('[useDealActions] Patch error:', e)
      const error = e instanceof Error ? e : new Error(String(e))
      onError?.(error)
      throw error
    } finally {
      setUpdating(false)
    }
  }

  async function del(id: string) {
    if (!confirm('Удалить сделку?')) return
    
    setDeleting(true)
    try {
      const res = await authFetch(`/admin-api/deals?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Delete failed: ${res.status}`)
      }
      onDelete?.(id)
      return true
    } catch (e) {
      console.error('[useDealActions] Delete error:', e)
      const error = e instanceof Error ? e : new Error(String(e))
      onError?.(error)
      throw error
    } finally {
      setDeleting(false)
    }
  }

  async function create(dealData: Partial<Deal>) {
    setCreating(true)
    try {
      const authHeaders = await getAuthHeaders()
      if (!authHeaders.Authorization) {
        throw new Error('User not authenticated')
      }

      const res = await authFetch('/admin-api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      onUpdate?.(data)
      return data
    } catch (e) {
      console.error('[useDealActions] Create error:', e)
      const error = e instanceof Error ? e : new Error(String(e))
      onError?.(error)
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
