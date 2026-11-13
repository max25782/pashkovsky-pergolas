/**
 * Pure state of the column editor (settings page and registration step):
 * rows in, drafts out. The component only renders it.
 */
import {
  DEFAULT_STAGE_COLOR,
  STAGE_LOCALES,
  sortStages,
  type DealStageDef,
  type StageDraft,
  type StageLabels,
  type StageRole,
} from '@/lib/deals/stages'

export interface EditorRow {
  /** Stable id for React and drag; not the stage key. */
  id: string
  /** Immutable key of a saved column; null for a column added in this session. */
  key: string | null
  role: StageRole | null
  color: string
  label: string
  labels: Record<(typeof STAGE_LOCALES)[number], string>
  isActive: boolean
}

function emptyLabels(): EditorRow['labels'] {
  return { he: '', ru: '', en: '', sr: '' }
}

export function rowsFromStages(stages: readonly DealStageDef[]): EditorRow[] {
  return sortStages(stages).map((s) => ({
    id: s.key,
    key: s.key,
    role: s.role,
    color: s.color,
    label: s.label ?? '',
    labels: { ...emptyLabels(), ...(s.labels ?? {}) } as EditorRow['labels'],
    isActive: s.isActive,
  }))
}

export function newRow(id: string, role: StageRole | null = null): EditorRow {
  return { id, key: null, role, color: DEFAULT_STAGE_COLOR, label: '', labels: emptyLabels(), isActive: true }
}

export function draftsFromRows(rows: readonly EditorRow[]): StageDraft[] {
  return rows.map((row) => {
    const labels: StageLabels = {}
    for (const locale of STAGE_LOCALES) {
      const text = row.labels[locale].trim()
      if (text) labels[locale] = text
    }
    return {
      key: row.key,
      role: row.role,
      color: row.color,
      label: row.label.trim() || null,
      labels: Object.keys(labels).length > 0 ? labels : null,
      isActive: row.isActive,
    }
  })
}

export function reorderRows<T>(rows: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return [...rows]
  const next = [...rows]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/** Saved, visible columns a column's deals can be moved to. */
export function moveTargets(rows: readonly EditorRow[], excludeKey: string): EditorRow[] {
  return rows.filter((r) => r.key !== null && r.key !== excludeKey && r.isActive)
}

export function isNameMissing(row: EditorRow, hasDefaultName: boolean): boolean {
  if (hasDefaultName) return false
  if (row.label.trim()) return false
  return !STAGE_LOCALES.some((locale) => row.labels[locale].trim())
}
