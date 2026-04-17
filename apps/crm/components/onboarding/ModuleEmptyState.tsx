'use client'

import Link from 'next/link'
import clsx from 'clsx'

export interface ModuleEmptyStateProps {
  title: string
  description?: string
  actionLabel: string
  /** Prefer `href` for navigation; use `onAction` for in-page actions (e.g. open modal). */
  actionHref?: string
  onAction?: () => void
  className?: string
}

export function ModuleEmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
}: ModuleEmptyStateProps) {
  const buttonClass =
    'inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400/50'

  return (
    <div
      className={clsx(
        'mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center',
        className,
      )}
    >
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {description ? <p className="mt-2 text-sm text-white/55">{description}</p> : null}
      <div className="mt-6">
        {actionHref ? (
          <Link href={actionHref} className={buttonClass}>
            {actionLabel}
          </Link>
        ) : (
          <button type="button" onClick={onAction} className={buttonClass}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}
