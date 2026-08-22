'use client'

/**
 * Отладочный маршрут для редактора плана — шаг 3C, доразвит промптом
 * «ламели, прогоны, стойки, крепление к стене».
 *
 * Живёт внутри аутентифицированной оболочки CRM: `app/app/layout.tsx` даёт
 * провайдеры/Tailwind/i18n/сайдбар, а `app/app/admin/layout.tsx` — реальную
 * авторизацию (редирект на /login при отсутствии пользователя; для не-суперадминов
 * ещё и проверку membership в компании). Роут ИЗНАЧАЛЬНО положили под
 * `app/app/debug/...` — там сайдбар и i18n есть, но авторизация фактически
 * отсутствует (`middleware.ts` пропускает всё под /app без проверки, а сам
 * `app/app/layout.tsx` её не делает — auth-гейт есть только в `admin/layout.tsx`).
 * Переехал под `admin/debug/`, чтобы соответствовать формулировке промпта
 * "внутри аутентифицированной оболочки приложения" по факту, а не только по
 * визуальной обёртке.
 *
 * Специально НЕ встроен в бизнес-поток (сделки/проекты/конфигуратор) — куда
 * редактор попадёт в продукте, отдельное решение.
 *
 * Контейнер канваса ниже — `position: relative` с заданной минимальной высотой:
 * без неё ResizeObserver внутри PlanCanvas намерит 0 и computeFitToScreenViewport
 * даст мусор (см. промпт шага 3C).
 *
 * ── Главный принцип этого шага (см. промпт) ──────────────────────────────
 * Шаг/ширина ламелей, прогоны, расстановка стоек, отмена стоек у стены —
 * правила РАСЧЁТНОГО ЯДРА (@pashkovsky/pergola-core), не рендера. Эта
 * страница только: (1) собирает PergolaSpec из контура редактора + панели
 * параметров конструктива, (2) зовёт computeFrame/computeLamellas/
 * computePurlins, (3) передаёт готовый CutPiece[] дальше в 3D — 3D ничего
 * не решает сам. Любое изменение параметра — новый вызов ядра и полная
 * пересборка сцены (buildPieces ниже — чистая функция от (полигон,
 * wallEdgeIndices, параметры), реактивно пересчитывается в useMemo).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { PlanEditor, type PlanEditorLabels } from '@pashkovsky/plan-editor'
import type { Point } from '@pashkovsky/plan-editor'
import {
  computeFrame,
  computeLamellas,
  computeLedStripLengthMm,
  compareStockLengthOptions,
  validateLamellaSpans,
  segmentBeamsForStock,
  segmentLedPurlinsForStock,
  DEFAULT_KERF_MM,
  DEFAULT_VISTUR_TOLERANCES,
} from '@pashkovsky/pergola-core'
import type { CutPiece, PergolaSpec, Point2D, ProfileDimensions, StructuralIssue } from '@pashkovsky/pergola-core'
import { PergolaCutPieceViewer } from '@pashkovsky/pergola-3d-preview'
import { TopPlanSheet, LamellaLayoutSheet, CellFrameSheet } from '@pashkovsky/pergola-drawing'
import { OrderAndCuttingPanel } from '@/components/cut-list/OrderAndCuttingPanel'

/**
 * Каталог профилей для отладочной страницы — ДЕМО-данные для проверки
 * пайплайна редактор → ядро → 3D/раскрой, не настоящий справочник поставщика
 * (тот отдельно — public/data/profiles.json). maxSpanMm/maxLamellaSpanMm/
 * availableStockLengthsMm ниже — иллюстративные значения (порядок величины
 * из монтажной практики, см. промпт «крепление к стене»/«стойки»), НЕ финальные
 * цифры поставщика — те даёт заказчик (см. открытый пункт в чате, «не
 * додумывать»).
 *
 * ОРИЕНТАЦИЯ (см. промпт «ориентация сечений профилей»): widthMm/heightMm —
 * НЕ порядок цифр в id профиля (тот неоднозначен — "f10040" читается и как
 * "100×40", и как "40×100"), а явная физическая ориентация — widthMm ВСЕГДА
 * горизонталь в плане (узкая грань, на которую садится балка/прогон), heightMm
 * ВСЕГДА вертикаль (высокая грань). Балка "100×40" ставится на 40мм ребро →
 * { widthMm: 40, heightMm: 100 }, а НЕ { widthMm: 100, heightMm: 40 } — см.
 * подробный JSDoc у ProfileDimensions в pergola-core/types.ts.
 *
 * ТРЕТИЙ ПРОФИЛЬ ЛАМЕЛИ — 20×20 (подтверждено заказчиком, см. чат): раньше
 * здесь стоял открытый вопрос ("это отдельный профиль или просто толщина
 * при lamellaOnEdge?") — заказчик подтвердил полный список из трёх профилей
 * ламели (20×20, 40×20, 70×20), все толщиной 20мм, различаются видимой
 * шириной. "На ребро" для 20×20 не меняет картину (квадратное сечение) —
 * это ожидаемо, не баг.
 */
const DEMO_PROFILES: Map<string, ProfileDimensions> = new Map([
  ['f8080', { widthMm: 80, heightMm: 80 }],
  ['f6060', { widthMm: 60, heightMm: 60 }],

  ['f10040', { widthMm: 40, heightMm: 100, maxSpanMm: 5000, availableStockLengthsMm: [6000, 7000] }],
  ['f12050', { widthMm: 50, heightMm: 120, maxSpanMm: 6000, availableStockLengthsMm: [6000, 7000, 8000] }],

  ['f2020', { widthMm: 20, heightMm: 20, maxLamellaSpanMm: 1500, availableStockLengthsMm: [6000] }],
  ['f4020', { widthMm: 40, heightMm: 20, maxLamellaSpanMm: 1500, availableStockLengthsMm: [6000] }],
  ['f7020', { widthMm: 70, heightMm: 20, maxLamellaSpanMm: 1500, availableStockLengthsMm: [6000] }],

  [
    // "60×40" прогон, узкая грань (40) горизонтально, широкая (60) вертикально.
    'purlin-led-6040',
    {
      widthMm: 40,
      heightMm: 60,
      interruptsLamella: true,
      hasLedChannel: true,
      availableStockLengthsMm: [6000, 7000],
    },
  ],
  [
    // "50×30" прогон, узкая грань (30) горизонтально, широкая (50) вертикально.
    'purlin-plain-5030',
    {
      widthMm: 30,
      heightMm: 50,
      interruptsLamella: false,
      hasLedChannel: false,
      availableStockLengthsMm: [6000, 7000],
    },
  ],
])

const BEAM_PROFILE_IDS = ['f10040', 'f12050'] as const
const POST_PROFILE_IDS = ['f8080', 'f6060'] as const
const PURLIN_PROFILE_IDS = ['purlin-led-6040', 'purlin-plain-5030'] as const
/** Значение в <select> для "без прогонов" — spec.purlinProfileId остаётся undefined (см. computePurlins: undefined ⇒ []). */
const NO_PURLIN = ''

/**
 * Раскладки ламелей (промпт «смешанные ламели — чередование разных
 * ширин»): пользователю НЕ дают собирать произвольную последовательность —
 * ровно четыре пункта в выпадающем списке, три однородных + один
 * смешанный. Однородный вариант — это узор длиной 1, а не отдельная ветка
 * кода: обе ветки (однородная/смешанная) идут через ОДНО и то же поле
 * spec.lamellaPattern → resolveLamellaPattern в ядре (см.
 * pergola-core/lamellaPattern.ts). Если позже появится ещё одно сочетание —
 * это новая строка в массиве ниже, без правки алгоритма или UI-компонента.
 */
interface LamellaPatternPreset {
  id: string
  /** Порядок id профилей — цикличный (см. PergolaSpec.lamellaPattern). Длина 1 = однородная раскладка. */
  pattern: readonly string[]
}

const LAMELLA_PATTERN_PRESETS: readonly LamellaPatternPreset[] = [
  { id: 'all-70', pattern: ['f7020'] },
  { id: 'all-40', pattern: ['f4020'] },
  { id: 'all-20', pattern: ['f2020'] },
  { id: 'mixed-70-40-20', pattern: ['f7020', 'f4020', 'f2020'] },
] as const

function getLamellaPatternPreset(id: string): LamellaPatternPreset {
  return LAMELLA_PATTERN_PRESETS.find((p) => p.id === id) ?? LAMELLA_PATTERN_PRESETS[0]
}

interface ConstructionParams {
  /** Id одного из LAMELLA_PATTERN_PRESETS — не сырой profileId (см. комментарий выше пресетов). */
  lamellaPatternId: string
  lamellaGapMm: number
  lamellaDirectionDeg: number
  /**
   * false (умолчание) — ламель плашмя (widthMm горизонталь, видна снизу).
   * true — "на ребро" (heightMm горизонталь). Параметр РАСЧЁТА, не рендера
   * — меняет шаг сканирования в computeLamellas и, следовательно, число
   * деталей/лист раскроя (см. промпт «ориентация сечений» п.3 и
   * pergola-core lamellas.ts VISIBLE WIDTH). Любое изменение → полный
   * пересчёт, как и остальные параметры этой панели. Применяется
   * одинаково к каждому профилю в раскладке, даже смешанной.
   */
  lamellaOnEdge: boolean
  beamProfileId: string
  purlinProfileId: string
  postProfileId: string
  /**
   * "Вистур" — заводская сборка целиком (см. промпт «рама-вистур»):
   * false (умолчание) — обычный монтаж на объекте, длина ламели равна
   * фактическому пролёту без вычетов (поведение не меняется). true —
   * computeLamellas вычитает заводские зазоры сборки (см. pergola-core
   * visturTolerances.ts — по умолчанию 30мм суммарно по длине, 15мм на
   * каждый реальный контурный конец). Влияет на реальные длины в раскрое,
   * поэтому опт-ин, а не глобальная константа.
   */
  visturMode: boolean
}

const DEFAULT_PARAMS: ConstructionParams = {
  lamellaPatternId: 'all-70',
  lamellaGapMm: 20,
  lamellaDirectionDeg: 0,
  lamellaOnEdge: false,
  visturMode: false,
  beamProfileId: 'f10040',
  // Defaults to the ONE interrupting purlin profile in this demo catalog
  // (see prompt "дефолт NO_PURLIN... выдаёт неисполнимую конструкцию
  // молча"): every lamella profile here caps out at maxLamellaSpanMm=1500mm,
  // so any span above ~1.5m needs an interrupting purlin regardless — NO_PURLIN
  // as a starting point just guarantees the very first "В 3D" click on a
  // real-sized polygon hits validateLamellaSpans. validateLamellaSpans stays
  // as the hard backstop (see buildPieces below) for whatever a user
  // deliberately switches to afterwards (NO_PURLIN, the non-interrupting
  // purlin-plain-5030, or a span too big even for this profile) — this
  // default does NOT replace that check, it just removes the friction of
  // hitting it on the very first try for no reason.
  purlinProfileId: 'purlin-led-6040',
  postProfileId: 'f8080',
}

function buildSpec(contourMm: Point2D[], wallEdgeIndices: number[], params: ConstructionParams): PergolaSpec {
  const pattern = getLamellaPatternPreset(params.lamellaPatternId).pattern
  return {
    contour: contourMm,
    heightMm: 2600,
    lamellaGapMm: params.lamellaGapMm,
    lamellaAngleDeg: 0,
    lamellaDirectionDeg: params.lamellaDirectionDeg,
    lamellaOnEdge: params.lamellaOnEdge,
    postProfileId: params.postProfileId,
    beamProfileId: params.beamProfileId,
    // lamellaProfileId is the required single-profile fallback field (used
    // only if lamellaPattern were ever unset) — always set to the pattern's
    // first entry so the two never disagree; lamellaPattern is authoritative
    // (see resolveLamellaPattern in pergola-core).
    lamellaProfileId: pattern[0],
    lamellaPattern: [...pattern],
    purlinProfileId: params.purlinProfileId || undefined,
    wallEdgeIndices,
    color: '#9aa0a6',
    visturTolerances: params.visturMode ? DEFAULT_VISTUR_TOLERANCES : undefined,
  }
}

/**
 * Ядро целиком: беседки/стойки/ламели/прогоны — три независимых вызова, как
 * и задумано в pergola-core (см. модуль-докстринги computeFrame/
 * computeLamellas/computePurlins).
 *
 * ВАЛИДАЦИЯ КОНСТРУКТИВА (см. промпт «дефолт NO_PURLIN... выдаёт
 * неисполнимую конструкцию молча»): пролёт ламели длиннее
 * profile.maxLamellaSpanMm без прогона (или с прогоном, который её не
 * "перебивает", interruptsLamella: false) физически провисает — это не
 * warning, а блокирующая ошибка, тем же контрактом, что computeFrame/
 * computeLamellas/computePurlins уже используют для отсутствующего профиля
 * (throw, а не молчаливый неверный результат). Намеренно не добавляем
 * дефолтный профиль прогона вместо этого: он не решает случай произвольного
 * пролёта (см. рабочий пример «6000 при maxLamellaSpanMm=1500» — дефолт
 * прогона мог бы сам не подойти без пересчёта числа прогонов), тогда как
 * явная ошибка ловит ЛЮБОЕ нарушение правила, а не только «забыли выбрать».
 */
interface BuiltPieces {
  pieces: CutPiece[]
  /**
   * See prompt "честная плашка для неортогональных форм" / `FrameResult.
   * isOrthogonal`'s own docstring in pergola-core — threaded through here
   * so the drawing sheets below can show the "approximate" warning banner
   * instead of silently trusting a non-orthogonal shape's post layout.
   */
  isOrthogonal: boolean
}

function buildPieces(contourMm: Point2D[], wallEdgeIndices: number[], params: ConstructionParams): BuiltPieces {
  const spec = buildSpec(contourMm, wallEdgeIndices, params)
  const frame = computeFrame(spec, DEMO_PROFILES)
  const lamellas = computeLamellas(spec, DEMO_PROFILES)

  // Rule B first (see prompt "ПРАВИЛО B — LED-БАЛКА"): reverses an LED
  // purlin's direction 90° — adding a plain divider + a denser short-purlin
  // grid — whenever its own span is longer than stock (falls straight
  // through to computePurlins' own unchanged output for every other case:
  // no purlinProfileId, a non-LED profile, or an LED purlin that already
  // fits — see segmentLedPurlinsForStock's own doc). Feeds frame.posts/
  // frame.beams so a divider can reuse an existing structural joint instead
  // of always guessing a fresh mid-span one.
  const ledResult = segmentLedPurlinsForStock(spec, DEMO_PROFILES, frame.posts, frame.beams, DEFAULT_KERF_MM)
  const purlins = [...ledResult.purlins, ...ledResult.dividers]

  // Rule A second (see prompt "ПРАВИЛО A — ОБЫЧНАЯ БАЛКА ПЕРИМЕТРА"):
  // splices a too-long perimeter beam only at a real structural joint
  // (existing post, or a crossing purlin/divider's own endpoint — hence
  // `purlins` from ABOVE, already including Rule B's dividers, is passed
  // as a crossing-piece candidate here), adding a new post only when
  // nothing else reaches.
  const beamResult = segmentBeamsForStock(spec, frame, [...lamellas, ...purlins], DEMO_PROFILES, DEFAULT_KERF_MM)

  const structuralIssues = validateLamellaSpans(lamellas, DEMO_PROFILES)
  if (structuralIssues.length > 0) {
    throw new Error(summarizeStructuralIssues(structuralIssues))
  }
  if (beamResult.issues.length > 0 || ledResult.issues.length > 0) {
    const lines = [
      ...beamResult.issues.map((i) => `  beam "${i.pieceId}" (profile "${i.profileId}"): ${i.message}`),
      ...ledResult.issues.map((i) => `  LED purlin (profile "${i.profileId}"): ${i.message}`),
    ]
    throw new Error(`Construction gap \u2014 cannot fit onto any available stock:\n${lines.join('\n')}`)
  }

  return {
    pieces: [...beamResult.beams, ...beamResult.posts, ...lamellas, ...purlins],
    isOrthogonal: frame.isOrthogonal,
  }
}

/**
 * validateLamellaSpans returns ONE issue per offending CutPiece — a real
 * pergola with many scan-line rows can produce dozens of pieces violating
 * the SAME structural rule. Two different shapes of "same rule, many rows"
 * both need collapsing, but not the same way:
 *   • A straight edge ⊥ to the lamellas → every row has the EXACT same span
 *     (e.g. 54 rows all at 4446mm) — exact grouping works.
 *   • A SLOPED edge (real-world trapezoid/angled contour) → each row's
 *     clipped length differs by ~1-2mm from its neighbour as the scan line
 *     climbs the slope (5460, 5461, 5463, 5465, … 5541mm) — grouping by
 *     rounded-mm span barely collapses anything (this is exactly what the
 *     user hit: 94 pieces → still ~48 near-duplicate lines).
 * Fix: cluster by PROXIMITY (sorted spans, new cluster whenever the gap to
 * the previous span exceeds GAP_THRESHOLD_MM) instead of exact/rounded
 * equality — a continuous run of close values collapses into one "min–max"
 * range, while a genuinely distant value (13117mm vs ~5500mm — two different
 * regions of the same pergola, not measurement noise on one edge) stays its
 * own line, which is real structural information the user needs (one region
 * needs far more purlins than the other).
 */
const SPAN_CLUSTER_GAP_MM = 500

interface SpanCluster {
  profileId: string
  count: number
  minSpanMm: number
  maxSpanMm: number
  limitMm: number
}

function clusterStructuralIssues(issues: StructuralIssue[]): SpanCluster[] {
  const byProfile = new Map<string, StructuralIssue[]>()
  for (const issue of issues) {
    byProfile.set(issue.profileId, [...(byProfile.get(issue.profileId) ?? []), issue])
  }

  const clusters: SpanCluster[] = []
  for (const [profileId, profileIssues] of byProfile) {
    const sorted = [...profileIssues].sort((a, b) => a.spanMm - b.spanMm)
    let clusterStart = 0
    for (let i = 1; i <= sorted.length; i++) {
      const isBoundary = i === sorted.length || sorted[i].spanMm - sorted[i - 1].spanMm > SPAN_CLUSTER_GAP_MM
      if (!isBoundary) continue
      const slice = sorted.slice(clusterStart, i)
      clusters.push({
        profileId,
        count: slice.length,
        minSpanMm: Math.round(slice[0].spanMm),
        maxSpanMm: Math.round(slice[slice.length - 1].spanMm),
        limitMm: slice[0].maxSpanMm,
      })
      clusterStart = i
    }
  }
  return clusters.sort((a, b) => b.maxSpanMm - a.maxSpanMm)
}

function summarizeStructuralIssues(issues: StructuralIssue[]): string {
  const lines = clusterStructuralIssues(issues).map((c) => {
    const range = c.minSpanMm === c.maxSpanMm ? `${c.minSpanMm}mm` : `${c.minSpanMm}\u2013${c.maxSpanMm}mm`
    return `  ${c.count}\u00d7 profile "${c.profileId}": ${range} unsupported (limit ${c.limitMm}mm)`
  })

  return (
    `Structural violation \u2014 ${issues.length} lamella piece(s) exceed their profile's maxLamellaSpanMm:\n` +
    `${lines.join('\n')}\n` +
    `Add a purlin profile with interruptsLamella: true and a high-enough purlin count, or a lamella profile rated for this span.`
  )
}

const ROLE_LABELS: Record<CutPiece['role'], string> = {
  beam: 'beam',
  post: 'post',
  lamella: 'lamella',
  purlin: 'purlin',
  hanger: 'hanger',
}

export default function PlanEditorDebugPage() {
  const t = useTranslations('planEditor')

  const [params, setParams] = useState<ConstructionParams>(DEFAULT_PARAMS)
  // Панель параметров конструктива закрыта по умолчанию (промпт «все опции
  // скрыты по умолчанию»): при открытии редактора видна только сцена и
  // минимум управления, все настройки — в выпадающей панели сбоку по кнопке.
  const [paramsOpen, setParamsOpen] = useState(false)

  // Последний полигон/набор пристенных сторон, полученные от кнопки «В 3D»
  // (см. AdjustPanel.onTo3D — второй аргумент это wallEdgeIndicesFromChain).
  // null = 3D-модалка ещё не открывалась в этой сессии редактора.
  const [lastPolygonMm, setLastPolygonMm] = useState<Point[] | null>(null)
  const [lastWallEdgeIndices, setLastWallEdgeIndices] = useState<number[]>([])
  const [preview3DOpen, setPreview3DOpen] = useState(false)
  // Лист «План сверху» (промпт «технический чертёж перголы») — отдельная
  // модалка рядом с 3D, кнопка появляется одновременно с «В 3D» (тот же
  // pieces из того же buildPieces, см. промпт «один источник правды» —
  // здесь НЕТ отдельного построения контура/CutPiece[] для чертежа).
  const [drawingOpen, setDrawingOpen] = useState(false)
  // Какой лист чертежа сейчас открыт — «План сверху» (осевые размеры по
  // всему контуру) или «Раскладка ламелей» (Вид Б, промпт «рама-вистур»:
  // ритм ламелей — просвет + шаг между рядами). Общая модалка, переключатель
  // сверху, а не отдельная кнопка/модалка на каждый лист — листов будет
  // больше (Разрез, Вид А, Схема стоек), отдельная кнопка на каждый не
  // масштабируется.
  const [drawingSheet, setDrawingSheet] = useState<'plan' | 'lamellaLayout' | 'cellFrame' | 'orderCutting'>('plan')
  const [preview3DError, setPreview3DError] = useState<string | null>(null)
  // Индикатор загрузки — computeFrame/computeLamellas синхронны и обычно
  // укладываются в единицы мс для типичного контура, но кнопка «В 3D» должна
  // честно показывать процесс (см. промпт «диагностика В 3D»): setTimeout(0)
  // ниже отдаёт React один тик на отрисовку спиннера ДО тяжёлого синхронного
  // расчёта — без этого JS-однопоточность не даст спиннеру попасть на экран
  // в том же событии, что его включило.
  const [isBuilding3D, setIsBuilding3D] = useState(false)

  const handleTo3D = useCallback(
    (polygonMm: Point[], wallEdgeIndices: number[]) => {
      console.log('[planEditor→3D] полигон из редактора:', polygonMm.length, 'вершин', polygonMm, 'wallEdgeIndices:', wallEdgeIndices)

      setPreview3DError(null)
      setIsBuilding3D(true)

      setTimeout(() => {
        try {
          const contour: Point2D[] = polygonMm.map((p): Point2D => [p.x, p.y])
          // Строим один раз здесь, чтобы поймать ошибку ДО открытия модалки
          // (тот же контракт, что раньше) — реальный рендер ниже пересчитывает
          // через тот же buildPieces в useMemo от lastPolygonMm/params.
          const built = buildPieces(contour, wallEdgeIndices, params)
          console.log('[planEditor→3D] computeFrame/computeLamellas/computePurlins →', built.pieces.length, 'CutPiece:', countByRole(built.pieces))

          setLastPolygonMm(polygonMm)
          setLastWallEdgeIndices(wallEdgeIndices)
          setPreview3DOpen(true)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error('[planEditor→3D] сбой пайплайна:', err)
          setPreview3DOpen(false)
          setPreview3DError(message)
        } finally {
          setIsBuilding3D(false)
        }
      }, 0)
    },
    [params],
  )

  // Реактивный пересчёт: любое изменение params (или самого контура) даёт
  // новый CutPiece[] без нового клика на «В 3D» — 3D-сцена всегда чистая
  // производная от (контур, параметры), как и требует промпт («любое
  // изменение → новый вызов ядра → полная пересборка сцены»).
  //
  // ВАЖНО (см. промпт про молчаливую неисполнимую конструкцию): если смена
  // параметра в открытой панели ДЕЛАЕТ конструкцию невалидной (buildPieces
  // теперь throw'ит из-за validateLamellaSpans — см. buildPieces выше), это
  // должно попасть в тот же видимый банер preview3DError, а не просто
  // console.error и молчаливое исчезновение сцены — эффект ниже синхронизирует
  // ошибку реактивного пересчёта в то же state, что и первый клик «В 3D».
  const buildResult = useMemo<{ pieces: CutPiece[] | null; isOrthogonal: boolean; error: string | null }>(() => {
    if (!lastPolygonMm) return { pieces: null, isOrthogonal: true, error: null }
    try {
      const contour: Point2D[] = lastPolygonMm.map((p): Point2D => [p.x, p.y])
      const built = buildPieces(contour, lastWallEdgeIndices, params)
      return { pieces: built.pieces, isOrthogonal: built.isOrthogonal, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[planEditor→3D] пересчёт после смены параметров упал:', err)
      return { pieces: null, isOrthogonal: true, error: message }
    }
  }, [lastPolygonMm, lastWallEdgeIndices, params])

  const pieces = buildResult.pieces
  const isOrthogonal = buildResult.isOrthogonal

  // Guarded by `lastPolygonMm` so this never clobbers an error handleTo3D just
  // set on the FIRST ("В 3D" before lastPolygonMm exists) failed attempt —
  // buildResult short-circuits to {null, null} while lastPolygonMm is still
  // null, which must NOT overwrite that fresh preview3DError with null.
  useEffect(() => {
    if (lastPolygonMm) setPreview3DError(buildResult.error)
  }, [buildResult.error, lastPolygonMm])

  const ledStripLengthMm = useMemo(
    () => (pieces ? computeLedStripLengthMm(pieces, DEMO_PROFILES) : 0),
    [pieces],
  )

  const stockComparisons = useMemo(() => {
    if (!pieces) return []
    return computeStockComparisons(pieces, DEMO_PROFILES)
  }, [pieces])

  const labels: PlanEditorLabels = useMemo(
    () => ({
      canvas: {
        closeContourTooltip: t('canvas.closeContourTooltip'),
      },
      edgeEditor: {
        lengthLabel: t('edgeEditor.lengthLabel'),
        angleLabel: t('edgeEditor.angleLabel'),
      },
      adjustPanel: {
        closeContourButton: t('adjustPanel.closeContourButton'),
        closeContourNeedMoreSides: t('adjustPanel.closeContourNeedMoreSides'),
        closeContourSelfIntersects: t('adjustPanel.closeContourSelfIntersects'),
        alignButton: t('adjustPanel.alignButton'),
        notClosedHint: t('adjustPanel.notClosedHint'),
        notAdjustedHint: t('adjustPanel.notAdjustedHint'),
        openSizesButton: t('adjustPanel.openSizesButton'),
        to3DButton: t('adjustPanel.to3DButton'),
        acceptButton: t('adjustPanel.acceptButton'),
        cancelButton: t('adjustPanel.cancelButton'),
        noGap: t('adjustPanel.noGap'),
        gapDistributed: (gapMm) => t('adjustPanel.gapDistributed', { gap: Math.round(gapMm) }),
        singleCulprit: (edgeNumber, residualMm, avgMm) =>
          t('adjustPanel.singleCulprit', {
            edge: edgeNumber,
            residual: Math.round(residualMm),
            avg: Math.round(avgMm),
          }),
        ambiguous: (edgeNumbers) => t('adjustPanel.ambiguous', { edges: edgeNumbers.join(', ') }),
        underDetermined: (count) => t('adjustPanel.underDetermined', { count }),
      },
      sizesPanel: {
        title: t('sizesPanel.title'),
        lengthHeader: t('sizesPanel.lengthHeader'),
        angleHeader: t('sizesPanel.angleHeader'),
        wallHeader: t('sizesPanel.wallHeader'),
        wallCheckboxTitle: t('sizesPanel.wallCheckboxTitle'),
        emptyMessage: t('sizesPanel.emptyMessage'),
        closeButton: t('sizesPanel.closeButton'),
        edgeLabel: (fromLetter, toLetter) => t('sizesPanel.edgeLabel', { from: fromLetter, to: toLetter }),
      },
    }),
    [t],
  )

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{t('title')}</h1>
        <div className="flex items-center gap-2">
          {pieces && (
            <button
              type="button"
              onClick={() => setDrawingOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              <span aria-hidden="true">📐</span>
              {t('drawing.openButton')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setParamsOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            <span aria-hidden="true">⚙️</span>
            {t('paramsPanel.toggleOpenButton')}
          </button>
        </div>
      </div>

      <ParamsDrawer open={paramsOpen} onClose={() => setParamsOpen(false)} t={t}>
        <ConstructionParamsPanel params={params} onChange={setParams} t={t} />
      </ParamsDrawer>

      <div className="relative min-h-[600px] w-full flex-1 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <PlanEditor labels={labels} onTo3D={handleTo3D} />
      </div>

      {isBuilding3D && (
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent dark:border-neutral-500" />
          {t('preview3D.building')}
        </div>
      )}

      {preview3DError && (
        <div className="whitespace-pre-line rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
          {preview3DError}
        </div>
      )}

      {preview3DOpen && pieces && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 p-4">
          <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
              <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {t('preview3D.title')}
              </span>
              <button
                type="button"
                onClick={() => setPreview3DOpen(false)}
                className="rounded px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                {t('preview3D.closeButton')}
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <PergolaCutPieceViewer pieces={pieces} profiles={DEMO_PROFILES} />
            </div>
            <div className="max-h-56 shrink-0 overflow-y-auto border-t border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900">
              <PieceSummary pieces={pieces} ledStripLengthMm={ledStripLengthMm} t={t} />
              <StockComparisonTable comparisons={stockComparisons} t={t} />
            </div>
          </div>
        </div>
      )}

      {drawingOpen && pieces && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 p-4">
          <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDrawingSheet('plan')}
                  className={
                    drawingSheet === 'plan'
                      ? 'rounded bg-neutral-900 px-3 py-1 text-sm font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900'
                      : 'rounded px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                  }
                >
                  {t('drawing.sheetPlan')}
                </button>
                <button
                  type="button"
                  onClick={() => setDrawingSheet('lamellaLayout')}
                  className={
                    drawingSheet === 'lamellaLayout'
                      ? 'rounded bg-neutral-900 px-3 py-1 text-sm font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900'
                      : 'rounded px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                  }
                >
                  {t('drawing.sheetLamellaLayout')}
                </button>
                <button
                  type="button"
                  onClick={() => setDrawingSheet('cellFrame')}
                  className={
                    drawingSheet === 'cellFrame'
                      ? 'rounded bg-neutral-900 px-3 py-1 text-sm font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900'
                      : 'rounded px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                  }
                >
                  {t('drawing.sheetCellFrame')}
                </button>
                <button
                  type="button"
                  onClick={() => setDrawingSheet('orderCutting')}
                  className={
                    drawingSheet === 'orderCutting'
                      ? 'rounded bg-neutral-900 px-3 py-1 text-sm font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900'
                      : 'rounded px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                  }
                >
                  {t('drawing.sheetOrderCutting')}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setDrawingOpen(false)}
                className="rounded px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                {t('preview3D.closeButton')}
              </button>
            </div>
            <div className="min-h-0 flex-1 bg-white dark:bg-neutral-900">
              {drawingSheet === 'plan' && (
                <TopPlanSheet
                  pieces={pieces}
                  profiles={DEMO_PROFILES}
                  isOrthogonal={isOrthogonal}
                  nonOrthogonalWarningText={t('drawing.nonOrthogonalWarning')}
                />
              )}
              {drawingSheet === 'lamellaLayout' && (
                <LamellaLayoutSheet pieces={pieces} profiles={DEMO_PROFILES} lamellaOnEdge={params.lamellaOnEdge} />
              )}
              {drawingSheet === 'cellFrame' && (
                <CellFrameSheet
                  pieces={pieces}
                  profiles={DEMO_PROFILES}
                  lamellaOnEdge={params.lamellaOnEdge}
                  lengthReductionTotalMm={params.visturMode ? DEFAULT_VISTUR_TOLERANCES.lamellaLengthReductionMm : 0}
                />
              )}
              {drawingSheet === 'orderCutting' && (
                <OrderAndCuttingPanel
                  pieces={pieces}
                  profiles={DEMO_PROFILES}
                  isOrthogonal={isOrthogonal}
                  nonOrthogonalWarningText={t('drawing.nonOrthogonalWarning')}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function countByRole(pieces: CutPiece[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const p of pieces) counts[p.role] = (counts[p.role] ?? 0) + 1
  return counts
}

interface ParamsDrawerProps {
  open: boolean
  onClose: () => void
  t: ReturnType<typeof useTranslations>
  children: ReactNode
}

/**
 * Выпадающая панель сбоку (промпт «все опции скрыты по умолчанию»): закрыта
 * при открытии редактора, не занимает место и не отвлекает; открывается по
 * кнопке-шестерёнке рядом с заголовком, закрывается по кнопке/фону/Esc.
 * Чисто UI-обёртка — какие параметры внутри, панели не важно (см.
 * ConstructionParamsPanel как единственный текущий потребитель).
 */
function ParamsDrawer({ open, onClose, t, children }: ParamsDrawerProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[600] flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-sm flex-col overflow-y-auto bg-white shadow-2xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
          <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {t('paramsPanel.title')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            {t('paramsPanel.toggleCloseButton')}
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </div>
    </div>
  )
}

interface ConstructionParamsPanelProps {
  params: ConstructionParams
  onChange: (params: ConstructionParams) => void
  t: ReturnType<typeof useTranslations>
}

/**
 * Параметры конструктива (промпт п.6): раскладка ламелей, зазор,
 * направление, ориентация ламели, профиль балки периметра, профиль
 * прогона, профиль стойки. Живёт прямо в хосте (не в @pashkovsky/plan-editor)
 * — это бизнес-каталог профилей CRM, редактор плана про него ничего не
 * знает (см. модуль-докстринг выше). Каждое изменение сразу меняет params →
 * useMemo выше пересобирает pieces → сцена/сводка/сравнение хлыстов
 * обновляются без нового клика на «В 3D» (см. handleTo3D/pieces).
 *
 * Раскладка вертикальная (flex-col) — панель теперь живёт в боковом
 * выдвижном drawer (ParamsDrawer), не в горизонтальной полосе над холстом.
 */
function ConstructionParamsPanel({ params, onChange, t }: ConstructionParamsPanelProps) {
  function patch(p: Partial<ConstructionParams>) {
    onChange({ ...params, ...p })
  }

  const selectClass =
    'rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100'
  const labelClass = 'flex flex-col gap-1 text-xs text-neutral-500 dark:text-neutral-400'

  return (
    <div className="flex flex-col gap-4">
      <label className={labelClass}>
        {t('paramsPanel.lamellaPatternLabel')}
        <select
          className={selectClass}
          value={params.lamellaPatternId}
          onChange={(e) => patch({ lamellaPatternId: e.target.value })}
        >
          {LAMELLA_PATTERN_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {formatPatternOption(preset, t)}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        {t('paramsPanel.lamellaGapLabel')}
        <input
          type="number"
          min={0}
          step={1}
          className={selectClass}
          value={params.lamellaGapMm}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (Number.isFinite(v) && v >= 0) patch({ lamellaGapMm: v })
          }}
        />
      </label>

      <label className={labelClass}>
        {t('paramsPanel.lamellaDirectionLabel')}
        <input
          type="number"
          step={1}
          className={selectClass}
          value={params.lamellaDirectionDeg}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (Number.isFinite(v)) patch({ lamellaDirectionDeg: v })
          }}
        />
      </label>

      <label className="flex flex-row items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400" title={t('paramsPanel.lamellaOnEdgeHint')}>
        <input
          type="checkbox"
          checked={params.lamellaOnEdge}
          onChange={(e) => patch({ lamellaOnEdge: e.target.checked })}
        />
        {t('paramsPanel.lamellaOnEdgeLabel')}
      </label>

      <label className="flex flex-row items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400" title={t('paramsPanel.visturModeHint')}>
        <input
          type="checkbox"
          checked={params.visturMode}
          onChange={(e) => patch({ visturMode: e.target.checked })}
        />
        {t('paramsPanel.visturModeLabel')}
      </label>

      <label className={labelClass}>
        {t('paramsPanel.beamProfileLabel')}
        <select
          className={selectClass}
          value={params.beamProfileId}
          onChange={(e) => patch({ beamProfileId: e.target.value })}
        >
          {BEAM_PROFILE_IDS.map((id) => (
            <option key={id} value={id}>
              {formatProfileOption(id)}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        {t('paramsPanel.purlinProfileLabel')}
        <select
          className={selectClass}
          value={params.purlinProfileId}
          onChange={(e) => patch({ purlinProfileId: e.target.value })}
        >
          <option value={NO_PURLIN}>{t('paramsPanel.purlinProfileNone')}</option>
          {PURLIN_PROFILE_IDS.map((id) => (
            <option key={id} value={id}>
              {formatProfileOption(id)}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        {t('paramsPanel.postProfileLabel')}
        <select
          className={selectClass}
          value={params.postProfileId}
          onChange={(e) => patch({ postProfileId: e.target.value })}
        >
          {POST_PROFILE_IDS.map((id) => (
            <option key={id} value={id}>
              {formatProfileOption(id)}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

/**
 * "mixed-70-40-20" → "70/40/20 мм" (или локализованный эквивалент) —
 * ширины выводятся из самого пресета (pattern.map(widthMm).join('/')), а не
 * из отдельно захардкоженной строки на пресет: для однородного узора длиной
 * 1 это естественно даёт "70 мм" без дублирования логики (см. промпт
 * «пресеты лежат в справочнике данными, а не ветками кода»). Оборачивающий
 * текст ("мм"/"mm"/"מ״מ"/"mm") идёт через i18n-шаблон, один на все пресеты.
 */
function formatPatternOption(preset: LamellaPatternPreset, t: ReturnType<typeof useTranslations>): string {
  const widths = preset.pattern.map((id) => DEMO_PROFILES.get(id)?.widthMm ?? '?').join('/')
  return t('paramsPanel.lamellaPatternOption', { widths })
}

/** "f7020" + справочник → "f7020 (70×20 мм)" — профиль читаемым текстом рядом с id, а не голым идентификатором. */
function formatProfileOption(profileId: string): string {
  const profile = DEMO_PROFILES.get(profileId)
  if (!profile) return profileId
  const traits: string[] = []
  if (profile.maxSpanMm) traits.push(`maxSpan ${profile.maxSpanMm}мм`)
  if (profile.maxLamellaSpanMm) traits.push(`maxSpan ${profile.maxLamellaSpanMm}мм`)
  if (profile.interruptsLamella) traits.push('перебивает ламель')
  if (profile.hasLedChannel) traits.push('LED')
  const traitsStr = traits.length > 0 ? ` — ${traits.join(', ')}` : ''
  return `${profileId} (${profile.widthMm}×${profile.heightMm} мм)${traitsStr}`
}

interface PieceSummaryProps {
  pieces: CutPiece[]
  ledStripLengthMm: number
  t: ReturnType<typeof useTranslations>
}

/** id → qty, e.g. {"f7020": 40, "f4020": 34, "f2020": 35} — one entry per DISTINCT profileId among the given pieces, not just per role (see mixed lamella pattern below). */
function countByProfile(pieces: CutPiece[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const p of pieces) counts[p.profileId] = (counts[p.profileId] ?? 0) + 1
  return counts
}

/** Разбивка CutPiece[] по ролям + суммарная длина LED-ленты — то, что диагностика шага 0 просила выводить, плюс новая цифра по LED (промпт «подсветка встроена в профиль прогона»). */
function PieceSummary({ pieces, ledStripLengthMm, t }: PieceSummaryProps) {
  const counts = countByRole(pieces)

  // Смешанная раскладка ламелей (промпт «в статистике... появились отдельные
  // группы по каждому профилю») — распадается на >1 profileId только когда
  // выбран смешанный пресет; для однородной раскладки это ровно 1 запись, и
  // строка ниже не показывается (не дублирует roleCount выше без причины).
  const lamellaProfileCounts = countByProfile(pieces.filter((p) => p.role === 'lamella'))
  const lamellaProfileIds = Object.keys(lamellaProfileCounts)

  return (
    <div className="mb-3 flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-300">
      <div className="flex flex-wrap items-center gap-4">
        {(Object.keys(ROLE_LABELS) as Array<CutPiece['role']>)
          .filter((role) => counts[role] > 0)
          .map((role) => (
            <span key={role}>
              {t('preview3D.roleCount', { role: t(`preview3D.role.${role}`), count: counts[role] })}
            </span>
          ))}
        {ledStripLengthMm > 0 && (
          <span className="font-medium text-amber-600 dark:text-amber-400">
            {t('preview3D.ledStripLength', { meters: (ledStripLengthMm / 1000).toFixed(1) })}
          </span>
        )}
      </div>
      {lamellaProfileIds.length > 1 && (
        <div className="flex flex-wrap items-center gap-3 text-neutral-500 dark:text-neutral-400">
          <span>{t('preview3D.lamellaBreakdownLabel')}</span>
          {lamellaProfileIds.map((profileId) => (
            <span key={profileId}>
              {t('preview3D.profileCount', { profile: formatProfileOption(profileId), count: lamellaProfileCounts[profileId] })}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

interface ProfileStockComparison {
  profileId: string
  comparison: ReturnType<typeof compareStockLengthOptions>
}

/** Группирует pieces по profileId и сравнивает варианты длины закупки для каждого профиля, у которого задан availableStockLengthsMm (см. промпт 3.1). */
function computeStockComparisons(
  pieces: CutPiece[],
  profiles: Map<string, ProfileDimensions>,
): ProfileStockComparison[] {
  const byProfile = new Map<string, CutPiece[]>()
  for (const piece of pieces) {
    const list = byProfile.get(piece.profileId) ?? []
    list.push(piece)
    byProfile.set(piece.profileId, list)
  }

  const result: ProfileStockComparison[] = []
  for (const [profileId, profilePieces] of byProfile) {
    const availableStockLengthsMm = profiles.get(profileId)?.availableStockLengthsMm
    if (!availableStockLengthsMm || availableStockLengthsMm.length === 0) continue
    result.push({
      profileId,
      comparison: compareStockLengthOptions(profilePieces, availableStockLengthsMm),
    })
  }
  return result
}

interface StockComparisonTableProps {
  comparisons: ProfileStockComparison[]
  t: ReturnType<typeof useTranslations>
}

/** Сравнение длин хлыстов по каждому использованному профилю — сколько хлыстов и сколько отхода на каждой доступной длине закупки (промпт 3.1: "пользователь должен видеть цифру до заказа"). */
function StockComparisonTable({ comparisons, t }: StockComparisonTableProps) {
  if (comparisons.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
        {t('preview3D.stockComparisonTitle')}
      </span>
      <div className="flex flex-wrap gap-4">
        {comparisons.map(({ profileId, comparison }) => (
          <table key={profileId} className="text-xs">
            <caption className="mb-1 text-left font-mono text-neutral-500 dark:text-neutral-400">
              {profileId}
            </caption>
            <thead>
              <tr className="text-neutral-500 dark:text-neutral-400">
                <th className="pr-3 text-left font-normal">{t('preview3D.stockLengthHeader')}</th>
                <th className="pr-3 text-left font-normal">{t('preview3D.barsHeader')}</th>
                <th className="text-left font-normal">{t('preview3D.wasteHeader')}</th>
              </tr>
            </thead>
            <tbody>
              {comparison.options.map((opt) => (
                <tr
                  key={opt.stockLengthMm}
                  className={
                    opt.stockLengthMm === comparison.bestStockLengthMm
                      ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                      : 'text-neutral-700 dark:text-neutral-300'
                  }
                >
                  <td className="pr-3">{(opt.stockLengthMm / 1000).toFixed(1)} м</td>
                  <td className="pr-3">{opt.barsUsed}</td>
                  <td>
                    {(opt.wasteMm / 1000).toFixed(2)} м ({opt.wastePercent.toFixed(1)}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  )
}
