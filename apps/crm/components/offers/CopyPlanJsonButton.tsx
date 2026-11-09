'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  buildPlanExportJson,
  copyTextToClipboard,
  type PlanExportInput,
} from '@/lib/pergolas/plan-export-json'

interface CopyPlanJsonButtonProps {
  /** Latest plan; null while no closed contour exists. Read on click, not on render. */
  getPlan: () => PlanExportInput | null
  className?: string
}

const DEFAULT_CLASS =
  'flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700'

export function CopyPlanJsonButton({ getPlan, className }: CopyPlanJsonButtonProps) {
  const t = useTranslations('planEditor')
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle')

  const handleClick = async () => {
    const plan = getPlan()
    if (!plan) {
      setStatus('error')
      return
    }
    try {
      await copyTextToClipboard(buildPlanExportJson(plan))
      setStatus('done')
    } catch (err) {
      console.error('[planEditor] copy plan JSON failed:', err)
      setStatus('error')
    }
    window.setTimeout(() => setStatus('idle'), 2500)
  }

  return (
    <button
      type="button"
      data-testid="copy-plan-json"
      onClick={() => void handleClick()}
      className={className ?? DEFAULT_CLASS}
    >
      <span aria-hidden="true">{'{ }'}</span>
      {status === 'done'
        ? t('drawing.copyJsonDone')
        : status === 'error'
          ? t('drawing.copyJsonError')
          : t('drawing.copyJsonButton')}
    </button>
  )
}
