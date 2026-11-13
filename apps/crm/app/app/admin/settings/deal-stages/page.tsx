'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { authFetch } from '@/lib/api/auth-fetch'
import { useDealStages } from '@/components/admin/hooks/useDealStages'
import { StageRowsEditor, type StageEditorLabels } from '@/components/admin/settings/StageRowsEditor'
import { draftsFromRows, isNameMissing, rowsFromStages, type EditorRow } from '@/lib/deals/stage-editor'
import {
  STAGE_LOCALES,
  STAGE_ROLES,
  STAGE_TEMPLATE_IDS,
  stagesFromTemplate,
  type StageLocale,
  type StageRole,
  type StageTemplateId,
} from '@/lib/deals/stages'

interface Conflict {
  /** The request to repeat once the user has decided. */
  body: Record<string, unknown>
  blocked: Array<{ key: string; dealCount: number }>
  warnings: Array<{ key: string; role: StageRole }>
  noCompletedStage: boolean
  /** Where deals of a blocked column may go: the rows (save) or the template's columns (reset). */
  targets: Array<{ key: string; name: string }>
}

function asLocale(value: string): StageLocale {
  return (STAGE_LOCALES as readonly string[]).includes(value) ? (value as StageLocale) : 'en'
}

export default function DealStagesSettingsPage() {
  const t = useTranslations('dealStages')
  const tDeals = useTranslations('deals.stages')
  const uiLocale = asLocale(useLocale())
  const { allStages, canEdit, dealCounts, isReady, isDefault, reload, labelOf } = useDealStages()

  const [rows, setRows] = useState<EditorRow[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [conflict, setConflict] = useState<Conflict | null>(null)
  const [moves, setMoves] = useState<Record<string, string>>({})
  const [template, setTemplate] = useState<StageTemplateId>('construction')

  useEffect(() => {
    if (isReady) setRows(rowsFromStages(allStages))
  }, [isReady, allStages])

  const defaultNameOf = (key: string) => (tDeals.has(key) ? tDeals(key) : undefined)

  const labels: StageEditorLabels = useMemo(
    () => ({
      namePlaceholder: t('namePlaceholder'),
      color: t('color'),
      hide: t('hide'),
      show: t('show'),
      hidden: t('hidden'),
      remove: t('remove'),
      moveUp: t('moveUp'),
      moveDown: t('moveDown'),
      add: t('add'),
      languages: t('languages'),
      deals: (count: number) => t('deals', { count }),
      role: t('role'),
      noRole: t('noRole'),
      roleLocked: t('roleLocked'),
      roleNames: Object.fromEntries(STAGE_ROLES.map((r) => [r, t(`roles.${r}`)])) as Record<StageRole, string>,
      languageNames: Object.fromEntries(STAGE_LOCALES.map((l) => [l, t(`languageNames.${l}`)])) as Record<
        StageLocale,
        string
      >,
    }),
    [t],
  )

  function errorText(codes: unknown): string {
    const list = Array.isArray(codes) ? (codes as string[]) : []
    const first = list[0]
    if (first && t.has(`errors.${first}`)) return t(`errors.${first}`)
    return t('errors.generic')
  }

  async function send(body: Record<string, unknown>, targets: Conflict['targets']) {
    setSaving(true)
    setMessage(null)
    try {
      const res = await authFetch('/admin-api/deal-stages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as {
        errors?: string[]
        code?: string
        blocked?: Conflict['blocked']
        warnings?: Conflict['warnings']
        noCompletedStage?: boolean
      }
      if (res.ok) {
        setConflict(null)
        setMoves({})
        await reload()
        setMessage({ kind: 'ok', text: t('saved') })
        return
      }
      if (res.status === 409 && data.code === 'stage_has_deals') {
        setConflict({ body, blocked: data.blocked ?? [], warnings: [], noCompletedStage: false, targets })
        return
      }
      if (res.status === 409 && data.code === 'stage_warnings') {
        setConflict({
          body,
          blocked: [],
          warnings: data.warnings ?? [],
          noCompletedStage: data.noCompletedStage === true,
          targets,
        })
        return
      }
      if (res.status === 503 && data.code === 'migration_not_applied') {
        setMessage({ kind: 'error', text: t('errors.migration_not_applied') })
        return
      }
      setMessage({ kind: 'error', text: errorText(data.errors) })
    } catch {
      setMessage({ kind: 'error', text: t('errors.generic') })
    } finally {
      setSaving(false)
    }
  }

  function rowTargets(): Conflict['targets'] {
    return rows
      .filter((r) => r.key !== null && r.isActive)
      .map((r) => ({ key: r.key as string, name: labelOf(r.key) }))
  }

  function save() {
    if (rows.some((row) => isNameMissing(row, row.key !== null && defaultNameOf(row.key) !== undefined))) {
      setMessage({ kind: 'error', text: t('nameRequired') })
      return
    }
    void send({ stages: draftsFromRows(rows) }, rowTargets())
  }

  function reset() {
    if (!window.confirm(t('resetConfirm'))) return
    const targets = stagesFromTemplate(template).map((s) => ({
      key: s.key,
      name: s.labels?.[uiLocale] ?? defaultNameOf(s.key) ?? s.key,
    }))
    void send({ resetToTemplate: template }, targets)
  }

  function continueWith(extra: Record<string, unknown>) {
    if (!conflict) return
    void send({ ...conflict.body, ...extra }, conflict.targets)
  }

  const allMovesChosen = conflict ? conflict.blocked.every((b) => moves[b.key]) : false
  const readOnly = !canEdit

  if (!isReady) {
    return <div className="p-8 text-white/70">{t('loading')}</div>
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-950 to-neutral-900 py-12 text-white">
      <div className="container mx-auto max-w-3xl px-6">
        <h1 className="mb-2 text-3xl font-extrabold">{t('title')}</h1>
        <p className="mb-2 text-white/70">{t('subtitle')}</p>
        <p className="mb-6 text-sm text-white/50">{t('roleHint')}</p>

        {readOnly ? (
          <p className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">
            {t('viewOnly')}
          </p>
        ) : null}
        {!readOnly && isDefault ? (
          <p className="mb-6 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-200">
            {t('defaultNotice')}
          </p>
        ) : null}

        <StageRowsEditor
          rows={rows}
          onChange={setRows}
          labels={labels}
          uiLocale={uiLocale}
          defaultNameOf={defaultNameOf}
          dealCounts={dealCounts}
          readOnly={readOnly}
        />

        {message ? (
          <p
            role="status"
            className={`mt-4 rounded-lg p-3 text-sm ${
              message.kind === 'ok' ? 'bg-emerald-500/10 text-emerald-200' : 'bg-red-500/10 text-red-200'
            }`}
          >
            {message.text}
          </p>
        ) : null}

        {conflict ? (
          <div className="mt-6 space-y-4 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4">
            {conflict.blocked.length > 0 ? (
              <>
                <h2 className="font-semibold">{t('conflictDealsTitle')}</h2>
                <p className="text-sm text-white/70">{t('conflictDealsText')}</p>
                {conflict.blocked.map((b) => (
                  <label key={b.key} className="block text-sm">
                    <span className="mb-1 block text-white">
                      {t('stageDeals', { name: labelOf(b.key), count: b.dealCount })}
                    </span>
                    <select
                      value={moves[b.key] ?? ''}
                      onChange={(e) => setMoves((prev) => ({ ...prev, [b.key]: e.target.value }))}
                      className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2"
                    >
                      <option value="">{t('chooseStage')}</option>
                      {conflict.targets
                        .filter((target) => target.key !== b.key)
                        .map((target) => (
                          <option key={target.key} value={target.key}>
                            {t('moveTo')}: {target.name}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={!allMovesChosen || saving}
                    onClick={() => continueWith({ moves })}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {t('moveAndContinue')}
                  </button>
                  <button type="button" onClick={() => setConflict(null)} className="rounded-lg px-4 py-2 text-sm text-white/70">
                    {t('cancel')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-semibold">{t('conflictWarnTitle')}</h2>
                <ul className="list-disc space-y-1 ps-5 text-sm text-white/80">
                  {conflict.warnings.map((w) => (
                    <li key={w.key}>{t('warnRole', { name: labelOf(w.key), role: t(`roles.${w.role}`) })}</li>
                  ))}
                  {conflict.noCompletedStage ? <li>{t('warnNoCompleted')}</li> : null}
                </ul>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => continueWith({ acknowledgeWarnings: true, moves })}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {t('continueAnyway')}
                  </button>
                  <button type="button" onClick={() => setConflict(null)} className="rounded-lg px-4 py-2 text-sm text-white/70">
                    {t('cancel')}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}

        {!readOnly ? (
          <>
            <button
              type="button"
              onClick={save}
              disabled={saving || rows.length === 0}
              className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? t('saving') : t('save')}
            </button>

            <section className="mt-12 rounded-xl border border-white/10 bg-white/5 p-4">
              <h2 className="mb-1 font-semibold">{t('resetTitle')}</h2>
              <p className="mb-3 text-sm text-white/60">{t('resetHint')}</p>
              <div className="flex flex-wrap gap-3">
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value as StageTemplateId)}
                  className="rounded-lg border border-white/20 bg-black/30 px-3 py-2"
                >
                  {STAGE_TEMPLATE_IDS.map((id) => (
                    <option key={id} value={id}>
                      {t(`templates.${id}`)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={reset}
                  disabled={saving}
                  className="rounded-lg border border-white/30 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
                >
                  {t('resetButton')}
                </button>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  )
}
