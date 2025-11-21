import { useState } from 'react'
import type { Deal } from '../deal-types'

interface UseDealDragDropParams {
  onStageChange: (dealId: string, newStage: string) => Promise<any>
}

export function useDealDragDrop({ onStageChange }: UseDealDragDropParams) {
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null)

  function handleDragStart(deal: Deal) {
    setDraggedDeal(deal)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  async function handleDrop(stage: string) {
    if (!draggedDeal) return
    if (draggedDeal.stage === stage) {
      setDraggedDeal(null)
      return
    }
    try {
      await onStageChange(draggedDeal.id, stage)
      setDraggedDeal(null)
    } catch (error) {
      console.error('Drop error:', error)
      setDraggedDeal(null)
    }
  }

  return {
    draggedDeal,
    handleDragStart,
    handleDragOver,
    handleDrop
  }
}

