'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Plus, Trash2 } from 'lucide-react'
import { newRow, reorderRows, type EditorRow } from '@/lib/deals/stage-editor'
import {
  STAGE_COLORS,
  STAGE_LOCALES,
  STAGE_ROLES,
  type StageLocale,
  type StageRole,
} from '@/lib/deals/stages'

export interface StageEditorLabels {
  namePlaceholder: string
  color: string
  hide: string
  show: string
  hidden: string
  remove: string
  moveUp: string
  moveDown: string
  add: string
  languages: string
  deals: (count: number) => string
  role: string
  noRole: string
  roleLocked: string
  roleNames: Record<StageRole, string>
  languageNames: Record<StageLocale, string>
}

interface StageRowsEditorProps {
  rows: EditorRow[]
  onChange: (rows: EditorRow[]) => void
  labels: StageEditorLabels
  /** Language of the screen: the name field edits this language's name when the column has one. */
  uiLocale: StageLocale
  /** Translated default name of a built-in column, shown while it has no name of its own. */
  defaultNameOf?: (key: string) => string | undefined
  dealCounts?: Record<string, number>
  readOnly?: boolean
  /** Registration: nothing is saved yet, so "hide" is pointless (just remove). */
  allowHide?: boolean
}

let tempCounter = 0

function nameOf(row: EditorRow, uiLocale: StageLocale): string {
  return row.labels[uiLocale] || row.label
}

export function StageRowsEditor({
  rows,
  onChange,
  labels,
  uiLocale,
  defaultNameOf,
  dealCounts = {},
  readOnly = false,
  allowHide = true,
}: StageRowsEditorProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [openLanguages, setOpenLanguages] = useState<string | null>(null)

  function update(id: string, patch: Partial<EditorRow>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function setName(row: EditorRow, value: string) {
    // The column's name in this language; a column with only one shared name edits that.
    if (row.labels[uiLocale]) update(row.id, { labels: { ...row.labels, [uiLocale]: value } })
    else update(row.id, { label: value })
  }

  function add() {
    tempCounter += 1
    onChange([...rows, newRow(`new-${Date.now()}-${tempCounter}`)])
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => {
        const count = row.key ? (dealCounts[row.key] ?? 0) : 0
        const defaultName = row.key ? defaultNameOf?.(row.key) : undefined
        return (
          <div
            key={row.id}
            draggable={!readOnly}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) onChange(reorderRows(rows, dragIndex, index))
              setDragIndex(null)
            }}
            onDragEnd={() => setDragIndex(null)}
            className={`rounded-xl border border-white/10 bg-white/5 p-4 ${row.isActive ? '' : 'opacity-60'}`}
          >
            <div className="flex flex-wrap items-center gap-3">
              {!readOnly ? <GripVertical className="h-5 w-5 shrink-0 cursor-grab text-white/40" aria-hidden /> : null}
              <span className={`h-4 w-4 shrink-0 rounded-full ${row.color}`} aria-hidden />
              <input
                type="text"
                value={nameOf(row, uiLocale)}
                onChange={(e) => setName(row, e.target.value)}
                placeholder={defaultName ?? labels.namePlaceholder}
                disabled={readOnly}
                maxLength={60}
                className="min-w-[10rem] flex-1 rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-white focus:border-blue-500 focus:outline-none disabled:opacity-70"
              />
              {!row.isActive ? (
                <span className="rounded bg-white/10 px-2 py-1 text-xs text-white/70">{labels.hidden}</span>
              ) : null}
              {row.key && count > 0 ? (
                <span className="rounded bg-blue-500/20 px-2 py-1 text-xs text-blue-200">{labels.deals(count)}</span>
              ) : null}
              {!readOnly ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onChange(reorderRows(rows, index, index - 1))}
                    disabled={index === 0}
                    aria-label={labels.moveUp}
                    className="rounded p-2 text-white/70 hover:bg-white/10 disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(reorderRows(rows, index, index + 1))}
                    disabled={index === rows.length - 1}
                    aria-label={labels.moveDown}
                    className="rounded p-2 text-white/70 hover:bg-white/10 disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  {allowHide ? (
                    <button
                      type="button"
                      onClick={() => update(row.id, { isActive: !row.isActive })}
                      aria-label={row.isActive ? labels.hide : labels.show}
                      title={row.isActive ? labels.hide : labels.show}
                      className="rounded p-2 text-white/70 hover:bg-white/10"
                    >
                      {row.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                    aria-label={labels.remove}
                    title={labels.remove}
                    className="rounded p-2 text-red-300 hover:bg-red-500/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>

            {!readOnly ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={labels.color}>
                  {STAGE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => update(row.id, { color })}
                      aria-label={color}
                      aria-pressed={row.color === color}
                      className={`h-5 w-5 rounded-full ${color} ${
                        row.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-900' : ''
                      }`}
                    />
                  ))}
                </div>

                <label className="flex items-center gap-2 text-sm text-white/70">
                  {labels.role}
                  {row.key === null ? (
                    <select
                      value={row.role ?? ''}
                      onChange={(e) => update(row.id, { role: (e.target.value || null) as StageRole | null })}
                      className="rounded-lg border border-white/20 bg-black/30 px-2 py-1 text-white"
                    >
                      <option value="">{labels.noRole}</option>
                      {STAGE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {labels.roleNames[role]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-white" title={labels.roleLocked}>
                      {row.role ? labels.roleNames[row.role] : labels.noRole}
                    </span>
                  )}
                </label>

                <button
                  type="button"
                  onClick={() => setOpenLanguages(openLanguages === row.id ? null : row.id)}
                  className="text-sm text-blue-300 hover:underline"
                >
                  {labels.languages}
                </button>
              </div>
            ) : null}

            {!readOnly && openLanguages === row.id ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {STAGE_LOCALES.map((locale) => (
                  <label key={locale} className="text-sm text-white/70">
                    {labels.languageNames[locale]}
                    <input
                      type="text"
                      dir={locale === 'he' ? 'rtl' : 'ltr'}
                      value={row.labels[locale]}
                      onChange={(e) => update(row.id, { labels: { ...row.labels, [locale]: e.target.value } })}
                      maxLength={60}
                      className="mt-1 w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                    />
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}

      {!readOnly ? (
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-2 rounded-lg border border-dashed border-white/30 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
        >
          <Plus className="h-4 w-4" />
          {labels.add}
        </button>
      ) : null}
    </div>
  )
}
