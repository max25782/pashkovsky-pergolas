import { useState } from 'react'
import type { Deal } from '../deal-types'
import { createDeal, updateDeal, deleteDeal } from '../deal-api'

interface UseDealActionsParams {
  adminToken: string
  isJWT?: boolean
  onUpdate?: (deal: Deal) => void
  onDelete?: (id: string) => void
  onError?: (error: Error) => void
}

export function useDealActions({
  adminToken,
  isJWT = false,
  onUpdate,
  onDelete,
  onError
}: UseDealActionsParams) {
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function patch(id: string, updates: Partial<Deal>) {
    setUpdating(true)
    try {
      console.log('useDealActions patch called with updates:', updates)
      const updatedDeal = await updateDeal(id, updates, adminToken, isJWT)
      console.log('useDealActions patch result:', updatedDeal)
      onUpdate?.(updatedDeal)
      return updatedDeal
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
    if (!confirm('Удалить сделку?')) return
    
    setDeleting(true)
    try {
      await deleteDeal(id, adminToken, isJWT)
      onDelete?.(id)
      // Возвращаем успешное удаление для перезагрузки данных
      return true
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

  async function create(dealData: Partial<Deal>) {
    setCreating(true)
    try {
      const newDeal = await createDeal(dealData, adminToken, isJWT)
      onUpdate?.(newDeal)
      return newDeal
    } catch (e: any) {
      console.error('Create error:', e)
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

