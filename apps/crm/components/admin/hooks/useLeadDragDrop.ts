import { useState } from 'react'
import type { Lead } from '../lead-types'

interface UseLeadDragDropParams {
  onStatusChange: (leadId: string, newStatus: string) => Promise<unknown>
}

export function useLeadDragDrop({ onStatusChange }: UseLeadDragDropParams) {
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null)

  function handleDragStart(lead: Lead) {
    setDraggedLead(lead)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  async function handleDrop(status: string) {
    if (!draggedLead) return
    const currentStatus = draggedLead.status || 'waiting'
    if (currentStatus === status) {
      setDraggedLead(null)
      return
    }
    try {
      await onStatusChange(draggedLead.id, status)
      setDraggedLead(null)
    } catch (error) {
      console.error('Drop error:', error)
      setDraggedLead(null)
    }
  }

  return {
    draggedLead,
    handleDragStart,
    handleDragOver,
    handleDrop
  }
}
