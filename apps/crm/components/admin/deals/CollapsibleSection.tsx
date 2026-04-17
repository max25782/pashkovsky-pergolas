'use client'

import { useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'

interface CollapsibleSectionProps {
  title: string
  defaultClosed?: boolean
  children: ReactNode
  className?: string
  /** Visually emphasize header (e.g. finance-adjacent sections) */
  variant?: 'default' | 'subtle'
}

export function CollapsibleSection({
  title,
  defaultClosed = false,
  children,
  className,
  variant = 'default',
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(!defaultClosed)

  return (
    <div
      className={clsx(
        'overflow-hidden rounded-xl border border-white/10 bg-gray-800/40',
        variant === 'subtle' && 'border-white/5 bg-gray-900/30',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start transition hover:bg-white/5"
        aria-expanded={open}
      >
        <span className="text-base font-semibold text-white">{title}</span>
        <ChevronDown
          className={clsx(
            'h-5 w-5 shrink-0 text-white/60 transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {open && (
        <div className="border-t border-white/10 px-4 py-4 ps-4 pe-4">{children}</div>
      )}
    </div>
  )
}
