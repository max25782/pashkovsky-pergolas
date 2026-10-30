'use client'

import { useState } from 'react'

export function ReplaceProfileNotice({
  message,
  replaceLabel,
  title,
  confirmLabel,
  options,
  onChoose,
}: {
  message: string
  replaceLabel: string
  title: string
  confirmLabel: string
  options: Array<{ id: string; label: string }>
  onChoose: (profileId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState('')

  return (
    <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
      <p>{message}</p>
      <button
        type="button"
        className="mt-2 rounded bg-amber-800 px-3 py-1 text-xs font-semibold text-white"
        onClick={() => {
          setChoice('')
          setOpen(true)
        }}
      >
        {replaceLabel}
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs">
            {title}
            <select
              className="rounded border border-amber-400 bg-white px-2 py-1 text-sm text-neutral-900"
              value={choice}
              onChange={(event) => setChoice(event.target.value)}
            >
              <option value="">—</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={choice === ''}
            className="rounded bg-neutral-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
            onClick={() => {
              if (choice === '') return
              onChoose(choice)
              setOpen(false)
            }}
          >
            {confirmLabel}
          </button>
        </div>
      )}
    </div>
  )
}
