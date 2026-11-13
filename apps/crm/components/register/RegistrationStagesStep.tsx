'use client'

import { useMemo, useState } from 'react'
import { StageRowsEditor, type StageEditorLabels } from '@/components/admin/settings/StageRowsEditor'
import { rowsFromStages, type EditorRow } from '@/lib/deals/stage-editor'
import {
  STAGE_TEMPLATE_IDS,
  stagesForNewFirm,
  type StageLocale,
  type StageTemplateId,
} from '@/lib/deals/stages'

type StepLanguage = 'en' | 'ru'

const STRINGS: Record<
  StepLanguage,
  {
    title: string
    hint: string
    template: string
    apply: string
    clear: string
    atLeastOne: string
    nameRequired: string
    templates: Record<StageTemplateId, string>
    editor: StageEditorLabels
  }
> = {
  en: {
    title: 'Which work stages do you want to see in your deals kanban?',
    hint: 'Pick a template and edit it, or start from scratch. You need at least one stage. You can change everything later in settings.',
    template: 'Template',
    apply: 'Use template',
    clear: 'Clear all',
    atLeastOne: 'Add at least one stage.',
    nameRequired: 'Every stage needs a name.',
    templates: {
      aluminum: 'Aluminum and pergolas',
      construction: 'Construction',
      repair: 'Repair and renovation',
      windows: 'Windows and doors',
      roofing: 'Roofing',
    },
    editor: {
      namePlaceholder: 'Stage name',
      color: 'Color',
      hide: 'Hide',
      show: 'Show',
      hidden: 'Hidden',
      remove: 'Remove stage',
      moveUp: 'Move up',
      moveDown: 'Move down',
      add: 'Add stage',
      languages: 'Names by language',
      deals: (count) => `${count}`,
      role: 'Function',
      noRole: 'No special function',
      roleLocked: 'Fixed',
      roleNames: {
        signed: 'Deal signed',
        material_ordered: 'Material ordered',
        material_arrived: 'Material arrived',
        in_production: 'In production / work',
        installation: 'Installation',
        completed: 'Completed (paid)',
      },
      languageNames: { he: 'Hebrew', ru: 'Russian', en: 'English', sr: 'Serbian' },
    },
  },
  ru: {
    title: 'Какие этапы работы вы хотите видеть в канбане сделок?',
    hint: 'Выберите шаблон и отредактируйте его или начните с нуля. Нужен хотя бы один этап. Всё можно изменить позже в настройках.',
    template: 'Шаблон',
    apply: 'Применить шаблон',
    clear: 'Очистить всё',
    atLeastOne: 'Добавьте хотя бы один этап.',
    nameRequired: 'У каждого этапа должно быть название.',
    templates: {
      aluminum: 'Алюминий и перголы',
      construction: 'Строительство',
      repair: 'Ремонт',
      windows: 'Окна и двери',
      roofing: 'Кровля',
    },
    editor: {
      namePlaceholder: 'Название этапа',
      color: 'Цвет',
      hide: 'Скрыть',
      show: 'Показать',
      hidden: 'Скрыт',
      remove: 'Удалить этап',
      moveUp: 'Выше',
      moveDown: 'Ниже',
      add: 'Добавить этап',
      languages: 'Названия по языкам',
      deals: (count) => `${count}`,
      role: 'Функция',
      noRole: 'Без особой функции',
      roleLocked: 'Не меняется',
      roleNames: {
        signed: 'Сделка подписана',
        material_ordered: 'Материал заказан',
        material_arrived: 'Материал получен',
        in_production: 'В производстве / в работе',
        installation: 'Монтаж',
        completed: 'Завершена (оплачена)',
      },
      languageNames: { he: 'Иврит', ru: 'Русский', en: 'Английский', sr: 'Сербский' },
    },
  },
}

/** Language of the visitor: Russian gets Russian text, everyone else English. */
function detectLanguage(): StepLanguage {
  if (typeof navigator === 'undefined') return 'en'
  return navigator.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

function detectLocale(): StageLocale {
  if (typeof navigator === 'undefined') return 'en'
  const lang = navigator.language?.toLowerCase().slice(0, 2)
  return lang === 'ru' || lang === 'he' || lang === 'sr' ? lang : 'en'
}

export function stageRowsValid(rows: readonly EditorRow[]): 'ok' | 'empty' | 'name' {
  if (rows.length === 0) return 'empty'
  const unnamed = rows.some(
    (row) =>
      !row.label.trim() &&
      !(['he', 'ru', 'en', 'sr'] as const).some((locale) => row.labels[locale].trim()),
  )
  return unnamed ? 'name' : 'ok'
}

interface Props {
  rows: EditorRow[]
  onChange: (rows: EditorRow[]) => void
  /** Industry chosen on the previous step: the template offered first. */
  initialTemplate: StageTemplateId
  error?: string | null
}

export function RegistrationStagesStep({ rows, onChange, initialTemplate, error }: Props) {
  const [language] = useState<StepLanguage>(detectLanguage)
  const [uiLocale] = useState<StageLocale>(detectLocale)
  const [template, setTemplate] = useState<StageTemplateId>(initialTemplate)
  const s = STRINGS[language]
  const editorLabels = useMemo(() => s.editor, [s])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">{s.title}</h2>
        <p className="mt-1 text-sm text-white/60">{s.hint}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-white/70" htmlFor="stage-template">
          {s.template}
        </label>
        <select
          id="stage-template"
          value={template}
          onChange={(e) => setTemplate(e.target.value as StageTemplateId)}
          className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm"
        >
          {STAGE_TEMPLATE_IDS.map((id) => (
            <option key={id} value={id}>
              {s.templates[id]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onChange(rowsFromStages(stagesForNewFirm(template)))}
          className="rounded-lg border border-white/30 px-3 py-2 text-sm hover:bg-white/10"
        >
          {s.apply}
        </button>
        <button
          type="button"
          onClick={() => onChange([])}
          className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10"
        >
          {s.clear}
        </button>
      </div>

      <StageRowsEditor
        rows={rows}
        onChange={onChange}
        labels={editorLabels}
        uiLocale={uiLocale}
        allowHide={false}
      />

      {error ? <p className="rounded-lg bg-red-500/20 p-3 text-sm text-red-200">{error}</p> : null}
    </div>
  )
}

export function stageStepErrorText(code: 'empty' | 'name', language: StepLanguage = detectLanguage()): string {
  return code === 'empty' ? STRINGS[language].atLeastOne : STRINGS[language].nameRequired
}
