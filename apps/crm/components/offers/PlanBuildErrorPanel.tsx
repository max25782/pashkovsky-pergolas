'use client'

import { useMemo, useState } from 'react'

const STRUCTURAL_PREFIX = 'Structural violation —'

function parseStructuralViolation(message: string): { summary: string; detailLines: string[] } | null {
  if (!message.startsWith(STRUCTURAL_PREFIX)) return null
  const lines = message.split('\n').map((l) => l.trimEnd())
  const summary = lines[0] ?? message
  const detailLines = lines.filter((l) => l.startsWith('  profile "'))
  return { summary, detailLines }
}

interface PlanBuildErrorPanelProps {
  message: string
  purlinProfileId: string
  purlinInterruptsLamella: boolean
  title: string
  confirmNote: string
  hintNoPurlin: string
  hintNonInterrupt: string
  hintDefault: string
  showDetailsLabel: (count: number) => string
  hideDetailsLabel: string
}

export function PlanBuildErrorPanel({
  message,
  purlinProfileId,
  purlinInterruptsLamella,
  title,
  confirmNote,
  hintNoPurlin,
  hintNonInterrupt,
  hintDefault,
  showDetailsLabel,
  hideDetailsLabel,
}: PlanBuildErrorPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const parsed = useMemo(() => parseStructuralViolation(message), [message])

  const hint =
    !purlinProfileId ? hintNoPurlin : !purlinInterruptsLamella ? hintNonInterrupt : hintDefault

  const previewLines = parsed?.detailLines.slice(0, 3) ?? []
  const restCount = parsed ? Math.max(0, parsed.detailLines.length - previewLines.length) : 0

  return (
    <div className="max-h-[min(28dvh,220px)] shrink-0 overflow-hidden rounded-lg border border-red-300 bg-red-50 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
      <div className="space-y-1 px-4 py-2">
        <p className="font-semibold">{title}</p>
        {parsed ? (
          <p className="text-red-900/90 dark:text-red-100">{parsed.summary}</p>
        ) : (
          <p className="whitespace-pre-line">{message}</p>
        )}
        <p className="text-xs text-red-800/80 dark:text-red-200/80">{hint}</p>
        <p className="text-xs text-red-700/70 dark:text-red-300/70">{confirmNote}</p>
      </div>
      {parsed && parsed.detailLines.length > 0 && (
        <div
          className={`border-t border-red-200/80 px-4 py-2 dark:border-red-900 ${expanded ? 'max-h-[min(22dvh,180px)] overflow-y-auto' : ''}`}
        >
          <ul className="space-y-0.5 font-mono text-xs leading-snug">
            {(expanded ? parsed.detailLines : previewLines).map((line, index) => (
              <li key={`${index}:${line}`}>{line.trim()}</li>
            ))}
          </ul>
          {restCount > 0 && (
            <button
              type="button"
              className="mt-2 text-xs font-medium underline"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? hideDetailsLabel : showDetailsLabel(parsed.detailLines.length)}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
