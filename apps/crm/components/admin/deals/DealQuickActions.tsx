'use client'

import clsx from 'clsx'

interface DealQuickActionsProps {
  onAddExpense: () => void
  onAddWorkDay: () => void
  labelExpense: string
  labelWorkDay: string
  className?: string
}

export function DealQuickActions({
  onAddExpense,
  onAddWorkDay,
  labelExpense,
  labelWorkDay,
  className,
}: DealQuickActionsProps) {
  const btn =
    'inline-flex flex-1 min-w-[140px] items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/40'

  return (
    <div className={clsx('flex flex-wrap gap-3', className)}>
      <button type="button" className={btn} onClick={onAddExpense}>
        {labelExpense}
      </button>
      <button type="button" className={btn} onClick={onAddWorkDay}>
        {labelWorkDay}
      </button>
    </div>
  )
}
