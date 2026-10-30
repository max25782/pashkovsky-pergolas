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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { PlanEditor, type PlanContourSnapshot, type PlanEditorLabels } from '@pashkovsky/plan-editor'
import type { Point } from '@pashkovsky/plan-editor'
import {
  buildDividerPickPieces,
  buildPiecesFromPlan,
  logDividerPickingDiagnostics,
  resolvePlanPurlinLines,
  beamProfileChangePatch,
  beamPlanWidthForDrawing,
  contourAxesMatchEnteredOuters,
  contourSideWidthMm,
  computeLedStripLengthMm,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  formatConstructionProfileLabel,
  LAMELLA_PATTERN_PRESETS,
  PERGOLA_CONSTRUCTION_PROFILES,
  CONSTRUCTION_BEAM_IDS,
  WALL_BEAM_PROFILE_IDS,
  CONSTRUCTION_POST_IDS,
  CONSTRUCTION_PURLIN_IDS,
  supportProfileOptions,
  supportProfileNeedsChoice,
  hasLongDividerWithoutSupport,
  WING_SHELF_SPAN_DIVIDER_ID,
  isRetiredProfileId,
  type PlanConstructionParams,
} from '@pashkovsky/pergola-core'
import type { CutPiece, PieceWarning, Point2D, ProfileDimensions } from '@pashkovsky/pergola-core'
import { PergolaCutPieceViewer } from '@pashkovsky/pergola-3d-preview'
import { LamellaWallThicknessField } from '@/components/offers/LamellaWallThicknessField'
import { RoofSlopeFields } from '@/components/offers/RoofSlopeFields'
import { Plan3DDividerControls } from '@/components/offers/Plan3DDividerControls'
import { PlanDrawingSheetsModal } from '@/components/offers/PlanDrawingSheetsModal'
import { ReplaceProfileNotice } from '@/components/offers/ReplaceProfileNotice'
import { readDebugPlanDocument, writeDebugPlanDocument } from '@/lib/pergolas/debug-plan-storage'
import {
  computeStockComparisons,
  PlanPieceSummary,
  PlanStockComparisonTable,
} from '@/components/offers/plan-pieces-summary'

/**
 * Construction catalog for the debug host — panda-alum supplier fields
 * (name, SKU, weight, wall, stock) plus construction span/LED flags.
 */
const DEMO_PROFILES = PERGOLA_CONSTRUCTION_PROFILES

const BEAM_PROFILE_IDS = CONSTRUCTION_BEAM_IDS
const POST_PROFILE_IDS = CONSTRUCTION_POST_IDS
const PURLIN_PROFILE_IDS = CONSTRUCTION_PURLIN_IDS
/** Значение в <select> для "без прогонов" — spec.purlinProfileId остаётся undefined (см. computePurlins: undefined ⇒ []). */
const NO_PURLIN = ''

type ConstructionParams = PlanConstructionParams

const DEFAULT_PARAMS: ConstructionParams = DEFAULT_PLAN_CONSTRUCTION_PARAMS

/** П-contour: two arms + a back span. Lamellas along Y so one divider line clips into two segments. */
const U_FIXTURE: Point[] = [
  { x: 0, y: 0 },
  { x: 2000, y: 0 },
  { x: 2000, y: 3500 },
  { x: 5000, y: 3500 },
  { x: 5000, y: 0 },
  { x: 7000, y: 0 },
  { x: 7000, y: 5500 },
  { x: 0, y: 5500 },
]

/** Max-L contour used to verify stock splices + 3D after long-run joints. */
const L_FIXTURE: Point[] = [
  { x: 0, y: 0 },
  { x: 5000, y: 0 },
  { x: 5000, y: 3500 },
  { x: 9000, y: 3500 },
  { x: 9000, y: 7500 },
  { x: 0, y: 7500 },
]

/** Acceptance midot: 400@0, 300@90, 800@180, 600@270, 400@0, 300@90 (cm). */
const MIDOT_FIXTURE: Point[] = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: -4000, y: 3000 },
  { x: -4000, y: -3000 },
  { x: 0, y: -3000 },
]

/** Live L: 4000 / 3000 / 8000 / 3500 / 12000 / 6500 (axis + measured outers). */
const LIVE_L_FIXTURE: Point[] = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 11960, y: 3000 },
  { x: 11960, y: 6460 },
  { x: 0, y: 6460 },
]
const LIVE_L_MEASURED = [4000, 3000, 8000, 3500, 12000, 6500]

function buildHostPieces(contourMm: Point2D[], wallEdgeIndices: number[], params: ConstructionParams) {
  return buildPiecesFromPlan({ contour: contourMm, wallEdgeIndices, params }, DEMO_PROFILES)
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
  const [editorKey, setEditorKey] = useState(0)
  const [fixtureContour, setFixtureContour] = useState<{
    polygon: Point[]
    wallIndices: number[]
    measuredOuterLengthMmByEdgeIndex?: Array<number | null>
  } | null>(null)
  // Лист «План сверху» (промпт «технический чертёж перголы») — отдельная
  // модалка рядом с 3D, кнопка появляется одновременно с «В 3D» (тот же
  // pieces из того же buildPieces, см. промпт «один источник правды» —
  // здесь НЕТ отдельного построения контура/CutPiece[] для чертежа).
  const [drawingOpen, setDrawingOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [storageReady, setStorageReady] = useState(false)
  const paramsRef = useRef(params)
  const polygonRef = useRef(lastPolygonMm)
  const wallsRef = useRef(lastWallEdgeIndices)
  paramsRef.current = params
  polygonRef.current = lastPolygonMm
  wallsRef.current = lastWallEdgeIndices
  const [selectedCanvasDividerId, setSelectedCanvasDividerId] = useState<string | null>(null)
  // Какой лист чертежа сейчас открыт — «План сверху» (осевые размеры по
  // всему контуру) или «Раскладка ламелей» (Вид Б, промпт «рама-вистур»:
  // ритм ламелей — просвет + шаг между рядами). Общая модалка, переключатель
  // сверху, а не отдельная кнопка/модалка на каждый лист — листов будет
  // больше (Разрез, Вид А, Схема стоек), отдельная кнопка на каждый не
  // масштабируется.
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
          const built = buildHostPieces(contour, wallEdgeIndices, params)
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

  const handleContourChange = useCallback(
    (contour: PlanContourSnapshot) => {
      if (!contour.isClosed || contour.polygon.length < 3) return
      setLastPolygonMm(contour.polygon)
      setLastWallEdgeIndices(contour.wallIndices)
      if (contour.measuredOuterLengthMmByEdgeIndex) {
        setParams((prev) => ({
          ...prev,
          measuredOuterLengthMmByEdgeIndex: contour.measuredOuterLengthMmByEdgeIndex,
        }))
      }
    },
    [],
  )

  const flushPlan = useCallback((): boolean => {
    const polygon = polygonRef.current
    if (!polygon || polygon.length < 3) return false
    try {
      const document = {
        polygon,
        wallIndices: wallsRef.current,
        params: paramsRef.current,
      }
      writeDebugPlanDocument(document)
      const read = readDebugPlanDocument()
      if (!read) throw new Error('empty')
      setParams(read.params)
      setLastPolygonMm(read.polygon)
      setLastWallEdgeIndices(read.wallIndices)
      setSaveStatus('saved')
      return true
    } catch {
      setSaveStatus('error')
      return false
    }
  }, [])

  useEffect(() => {
    const stored = readDebugPlanDocument()
    if (stored) {
      setParams(stored.params)
      setLastPolygonMm(stored.polygon)
      setLastWallEdgeIndices(stored.wallIndices)
      setFixtureContour({
        polygon: stored.polygon,
        wallIndices: stored.wallIndices,
        measuredOuterLengthMmByEdgeIndex: stored.params.measuredOuterLengthMmByEdgeIndex,
      })
      setEditorKey((key) => key + 1)
      setSaveStatus('saved')
    }
    setStorageReady(true)
  }, [])

  useEffect(() => {
    if (!storageReady) return
    const polygon = lastPolygonMm
    if (!polygon || polygon.length < 3) return
    setSaveStatus('saving')
    const timer = window.setTimeout(() => {
      try {
        writeDebugPlanDocument({ polygon, wallIndices: lastWallEdgeIndices, params })
        const read = readDebugPlanDocument()
        if (!read) throw new Error('empty')
        setSaveStatus('saved')
      } catch {
        setSaveStatus('error')
      }
    }, 500)
    return () => window.clearTimeout(timer)
  }, [storageReady, params, lastPolygonMm, lastWallEdgeIndices])

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
  const buildResult = useMemo<{
    pieces: CutPiece[] | null
    structuralPurlins: CutPiece[]
    isOrthogonal: boolean
    error: string | null
    roofWarning: string | null
    warnings: PieceWarning[]
  }>(() => {
    if (!lastPolygonMm) {
      return { pieces: null, structuralPurlins: [], isOrthogonal: true, error: null, roofWarning: null, warnings: [] }
    }
    try {
      const contour: Point2D[] = lastPolygonMm.map((p): Point2D => [p.x, p.y])
      const built = buildHostPieces(contour, lastWallEdgeIndices, params)
      return {
        pieces: built.pieces,
        structuralPurlins: built.structuralPurlins,
        isOrthogonal: built.isOrthogonal,
        error: null,
        roofWarning: built.roof.warning,
        warnings: built.warnings,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[planEditor→3D] пересчёт после смены параметров упал:', err)
      return { pieces: null, structuralPurlins: [], isOrthogonal: true, error: message, roofWarning: null, warnings: [] }
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

  const dividerPickPieces = useMemo(() => {
    if (!lastPolygonMm || lastPolygonMm.length < 3) return []
    const contour = lastPolygonMm.map((p): Point2D => [p.x, p.y])
    return buildDividerPickPieces(contour, params, DEMO_PROFILES)
  }, [lastPolygonMm, params])

  useEffect(() => {
    if (!preview3DOpen || !pieces || !lastPolygonMm) return
    const contour = lastPolygonMm.map((p): Point2D => [p.x, p.y])
    logDividerPickingDiagnostics(
      contour,
      params,
      DEMO_PROFILES,
      buildResult.structuralPurlins,
      pieces.filter((p) => p.role === 'purlin'),
    )
  }, [preview3DOpen, pieces, buildResult.structuralPurlins, lastPolygonMm, params])

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
          <button
            type="button"
            onClick={() => {
              setFixtureContour({ polygon: U_FIXTURE, wallIndices: [] })
              setLastPolygonMm(U_FIXTURE)
              setLastWallEdgeIndices([])
              setParams({ ...DEFAULT_PARAMS, lamellaDirectionDeg: 90 })
              setEditorKey((key) => key + 1)
              setPreview3DOpen(true)
            }}
            className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            U-fixture
          </button>
          <button
            type="button"
            onClick={() => {
              setFixtureContour({ polygon: L_FIXTURE, wallIndices: [] })
              setLastPolygonMm(L_FIXTURE)
              setLastWallEdgeIndices([])
              setParams({
                ...DEFAULT_PARAMS,
                postMaxSpanMm: 4000,
                purlinProfileId: 'PA3022',
                lamellaDirectionDeg: 0,
              })
              setEditorKey((key) => key + 1)
              setPreview3DOpen(true)
            }}
            className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            L-fixture
          </button>
          <button
            type="button"
            onClick={() => {
              const measured = [4000, 3000, 8000, 6000, 4000, 3000]
              setFixtureContour({
                polygon: MIDOT_FIXTURE,
                wallIndices: [],
                measuredOuterLengthMmByEdgeIndex: measured,
              })
              setLastPolygonMm(MIDOT_FIXTURE)
              setLastWallEdgeIndices([])
              setParams({ ...DEFAULT_PARAMS, measuredOuterLengthMmByEdgeIndex: measured })
              setEditorKey((key) => key + 1)
              setPreview3DOpen(false)
            }}
            className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            Midot-fixture
          </button>
          <button
            type="button"
            onClick={() => {
              setFixtureContour({
                polygon: LIVE_L_FIXTURE,
                wallIndices: [],
                measuredOuterLengthMmByEdgeIndex: LIVE_L_MEASURED,
              })
              setLastPolygonMm(LIVE_L_FIXTURE)
              setLastWallEdgeIndices([])
              setParams({
                ...DEFAULT_PARAMS,
                measuredOuterLengthMmByEdgeIndex: LIVE_L_MEASURED,
                purlinMaxSpanMm: 4000,
                purlinProfileId: 'PA3022',
                beamProfileId: 'F20050',
                lamellaDirectionDeg: 0,
                lamellaSectionLayoutVersion: 1,
                purlinClearLayoutVersion: 1,
              })
              setEditorKey((key) => key + 1)
              setPreview3DOpen(true)
            }}
            className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            12m-L
          </button>
          {saveStatus !== 'idle' && (
            <span data-testid="save-status" className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
              {saveStatus === 'saving'
                ? t('paramsPanel.saveSaving')
                : saveStatus === 'error'
                  ? t('paramsPanel.saveError')
                  : t('paramsPanel.saveSaved')}
            </span>
          )}
          {pieces && (
            <button
              type="button"
              onClick={() => {
                flushPlan()
                setDrawingOpen(true)
              }}
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
        <ConstructionParamsPanel
          params={params}
          onChange={setParams}
          t={t}
          contourMm={lastPolygonMm}
          wallEdgeIndices={lastWallEdgeIndices}
          longDivider={hasLongDividerWithoutSupport(
            (pieces ?? [])
              .filter((piece) => piece.role === 'purlin' && piece.dividerId !== WING_SHELF_SPAN_DIVIDER_ID)
              .map((piece) => piece.lengthAxisMm),
            params.purlinMaxSpanMm,
          )}
        />
      </ParamsDrawer>

      <div className="flex min-h-0 w-full flex-1 flex-col gap-3 xl:flex-row">
        <div className="relative h-[520px] w-full flex-1 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
          <PlanEditor
            key={editorKey}
            labels={labels}
            onTo3D={handleTo3D}
            onContourChange={handleContourChange}
            initialContour={fixtureContour ?? undefined}
            construction={{
              params,
              profiles: DEMO_PROFILES,
              selectedDividerId: selectedCanvasDividerId,
              onSelectDivider: setSelectedCanvasDividerId,
            }}
          />
        </div>
        {preview3DOpen && pieces && (
          <div className="flex h-auto w-full min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
              <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {t('preview3D.title')}
              </span>
              <button
                type="button"
                onClick={() => setPreview3DOpen(false)}
                className="rounded px-2 py-1 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                {t('preview3D.closeButton')}
              </button>
            </div>
            {buildResult.roofWarning && (
              <p className="border-b border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
                {buildResult.roofWarning}
              </p>
            )}
            <Plan3DDividerControls
              contour={(lastPolygonMm ?? []).map((p): Point2D => [p.x, p.y])}
              params={params}
              profiles={DEMO_PROFILES}
              warnings={buildResult.warnings}
              dividerIds={
                lastPolygonMm
                  ? resolvePlanPurlinLines(
                      lastPolygonMm.map((p): Point2D => [p.x, p.y]),
                      params,
                      DEMO_PROFILES,
                    ).map((line) => line.id)
                  : []
              }
              onChange={setParams}
              t={t}
            >
                {(bind) => (
                <PergolaCutPieceViewer
                  pieces={pieces}
                  profiles={DEMO_PROFILES}
                  colorHex={params.colorHex}
                  dividerHitPieces={dividerPickPieces}
                  {...bind}
                />
              )}
            </Plan3DDividerControls>
            <div className="max-h-40 shrink-0 overflow-y-auto border-t border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">
              <PlanPieceSummary pieces={pieces} ledStripLengthMm={ledStripLengthMm} profiles={DEMO_PROFILES} />
              <PlanStockComparisonTable comparisons={stockComparisons} />
            </div>
          </div>
        )}
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

      {drawingOpen && pieces && (
        <PlanDrawingSheetsModal
          open={drawingOpen}
          onClose={() => setDrawingOpen(false)}
          pieces={pieces}
          profiles={DEMO_PROFILES}
          isOrthogonal={isOrthogonal}
          lamellaOnEdge={params.lamellaOnEdge}
          visturMode={params.visturMode}
          planContour={(lastPolygonMm ?? []).map((p): Point2D => [p.x, p.y])}
          wallEdgeIndices={lastWallEdgeIndices}
          constructionParams={params}
          lamellaDirectionDeg={params.lamellaDirectionDeg}
          initialSheet="plan"
          exportBlocked={saveStatus === 'error'}
          beforePrint={async () => flushPlan()}
          onReplaceProfile={(field, profileId) => {
            setParams((prev) => ({ ...prev, [field]: profileId }))
          }}
        />
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

function contourMismatch(
  contourMm: Array<{ x: number; y: number }> | null,
  wallEdgeIndices: number[],
  params: ConstructionParams,
): boolean {
  if (!contourMm || contourMm.length < 3) return false
  const width = beamPlanWidthForDrawing(PERGOLA_CONSTRUCTION_PROFILES, params.beamProfileId).planWidthMm
  return contourAxesMatchEnteredOuters({
    contour: contourMm.map((point): Point2D => [point.x, point.y]),
    measuredOuterLengthMmByEdgeIndex: params.measuredOuterLengthMmByEdgeIndex,
    defaultBeamPlanWidthMm: width,
    planWidthForEdge: (edgeIndex) => contourSideWidthMm(PERGOLA_CONSTRUCTION_PROFILES, edgeIndex, {
      wallEdgeIndices,
      beamProfileId: params.beamProfileId,
      wallProfileId: params.wallProfileId,
      wallBeamWidthVersion: params.wallBeamWidthVersion,
    }),
  }) === 'mismatch'
}

interface ConstructionParamsPanelProps {
  params: ConstructionParams
  onChange: (params: ConstructionParams) => void
  t: ReturnType<typeof useTranslations>
  contourMm: Point[] | null
  wallEdgeIndices: number[]
  longDivider?: boolean
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
function ConstructionParamsPanel({
  params,
  onChange,
  t,
  contourMm,
  wallEdgeIndices,
  longDivider = false,
}: ConstructionParamsPanelProps) {
  function patch(p: Partial<ConstructionParams>) {
    onChange({ ...params, ...p })
  }

  const selectClass =
    'rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100'
  const labelClass = 'flex flex-col gap-1 text-xs text-neutral-500 dark:text-neutral-400'
  const contourBuiltForOtherBeamWidth = contourMismatch(contourMm, wallEdgeIndices, params)

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

      <LamellaWallThicknessField
        params={params}
        onChange={onChange}
        selectClass={selectClass}
        labelClass={labelClass}
      />

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
          onChange={(e) => patch(beamProfileChangePatch(e.target.value))}
        >
          {BEAM_PROFILE_IDS.map((id) => (
            <option key={id} value={id}>
              {formatProfileOption(id)}
            </option>
          ))}
        </select>
        {contourBuiltForOtherBeamWidth && (
          <span className="text-amber-800 dark:text-amber-200">{t('drawing.contourBeamWidth')}</span>
        )}
      </label>

      <label className={labelClass}>
        {t('paramsPanel.wallBeamProfileLabel')}
        <select
          className={selectClass}
          value={params.wallProfileId ?? 'f10040'}
          onChange={(e) => patch({ wallProfileId: e.target.value, wallBeamWidthVersion: 1 })}
        >
          {WALL_BEAM_PROFILE_IDS.map((id) => (
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
          {(isRetiredProfileId(params.purlinProfileId) && !PURLIN_PROFILE_IDS.includes(params.purlinProfileId)
            ? [params.purlinProfileId, ...PURLIN_PROFILE_IDS]
            : PURLIN_PROFILE_IDS
          ).map((id) => (
            <option key={id} value={id}>
              {formatProfileOption(id)}{isRetiredProfileId(id) ? ' · ישן' : ''}
            </option>
          ))}
        </select>
        {params.purlinProfileId !== '' && !DEMO_PROFILES.has(params.purlinProfileId) && (
          <ReplaceProfileNotice
            message={t('drawing.profileRetired', { profile: params.purlinProfileId })}
            replaceLabel={t('drawing.replaceProfile')}
            title={t('drawing.replaceProfileTitle')}
            confirmLabel={t('drawing.replaceProfile')}
            options={PURLIN_PROFILE_IDS.filter((id) => !isRetiredProfileId(id)).map((id) => ({
              id,
              label: formatProfileOption(id),
            }))}
            onChoose={(profileId) => patch({ purlinProfileId: profileId })}
          />
        )}
      </label>

      <label className={labelClass} title={t('paramsPanel.purlinMaxSpanHint')}>
        {t('paramsPanel.purlinMaxSpanLabel')}
        <input
          type="number"
          min={1}
          step={100}
          className={selectClass}
          value={params.purlinMaxSpanMm ?? ''}
          placeholder="—"
          onChange={(e) => {
            const raw = e.target.value.trim()
            if (raw === '') {
              const next = { ...params }
              delete next.purlinMaxSpanMm
              onChange(next)
              return
            }
            const v = parseFloat(raw)
            if (Number.isFinite(v) && v > 0) patch({ purlinMaxSpanMm: v })
          }}
        />
        <span className="text-[11px] leading-snug text-neutral-400 dark:text-neutral-500">
          {t('paramsPanel.purlinMaxSpanHint')}
        </span>
        {longDivider && (
          <span className="font-medium text-amber-800 dark:text-amber-300">
            {t('drawing.longDividerNoSupport')}
          </span>
        )}
      </label>

      <label className={labelClass}>
        {t('paramsPanel.wingShelfProfileLabel')}
        <select
          data-testid="support-profile"
          className={selectClass}
          value={params.wingShelfProfileId ?? ''}
          onChange={(e) => {
            if (e.target.value === '') {
              const next = { ...params }
              delete next.wingShelfProfileId
              onChange(next)
              return
            }
            patch({ wingShelfProfileId: e.target.value })
          }}
        >
          {!params.wingShelfProfileId && <option value="">—</option>}
          {supportProfileNeedsChoice(params.wingShelfProfileId) && params.wingShelfProfileId && (
            <option value={params.wingShelfProfileId}>{params.wingShelfProfileId}</option>
          )}
          {supportProfileOptions.map((id) => (
            <option key={id} value={id}>
              {formatProfileOption(id)}
            </option>
          ))}
        </select>
        {supportProfileNeedsChoice(params.wingShelfProfileId) && params.wingShelfProfileId && (
          <ReplaceProfileNotice
            message={
              isRetiredProfileId(params.wingShelfProfileId)
                ? t('drawing.profileRetired', { profile: params.wingShelfProfileId })
                : t('drawing.supportProfileBlocked', { profile: params.wingShelfProfileId })
            }
            replaceLabel={t('drawing.replaceProfile')}
            title={t('drawing.replaceProfileTitle')}
            confirmLabel={t('drawing.replaceProfile')}
            options={supportProfileOptions.map((id) => ({ id, label: formatProfileOption(id) }))}
            onChoose={(profileId) => patch({ wingShelfProfileId: profileId })}
          />
        )}
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

      <label className={labelClass}>
        {t('paramsPanel.heightLabel')}
        <input
          type="number"
          min={1000}
          step={50}
          className={selectClass}
          value={params.heightMm}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (Number.isFinite(v) && v > 0) patch({ heightMm: v })
          }}
        />
      </label>

      <label className={labelClass}>
        {t('paramsPanel.lamellaAngleLabel')}
        <select
          className={selectClass}
          value={params.lamellaAngleDeg}
          onChange={(e) => patch({ lamellaAngleDeg: e.target.value === '45' ? 45 : 0 })}
        >
          <option value={0}>0°</option>
          <option value={45}>45°</option>
        </select>
      </label>

      <label className={labelClass}>
        {t('paramsPanel.colorHexLabel')}
        <select
          className={selectClass}
          value={params.colorHex}
          onChange={(e) => patch({ colorHex: e.target.value })}
        >
          <option value="#9aa0a6">RAL 9006 / #9aa0a6</option>
          <option value="RAL7016">RAL 7016</option>
          <option value="RAL8019">RAL 8019</option>
          <option value="RAL9010">RAL 9010</option>
          <option value="wood:oak">Wood / oak</option>
        </select>
      </label>

      <label className={labelClass}>
        {t('paramsPanel.supportTypeLabel')}
        <select
          className={selectClass}
          value={params.supportType}
          onChange={(e) => {
            const v = e.target.value
            if (v === 'free-standing' || v === 'wall-mounted' || v === 'hanging') {
              patch({ supportType: v })
            }
          }}
        >
          <option value="free-standing">{t('paramsPanel.supportFreeStanding')}</option>
          <option value="wall-mounted">{t('paramsPanel.supportWallMounted')}</option>
          <option value="hanging">{t('paramsPanel.supportHanging')}</option>
        </select>
      </label>

      <RoofSlopeFields
        params={params}
        onChange={onChange}
        contourMm={contourMm}
        wallEdgeIndices={wallEdgeIndices}
        profiles={DEMO_PROFILES}
        selectClass={selectClass}
        labelClass={labelClass}
      />
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
function formatPatternOption(
  preset: { id: string; pattern: string[] },
  t: ReturnType<typeof useTranslations>,
): string {
  const widths = preset.pattern.map((id) => {
    const profile = DEMO_PROFILES.get(id)
    if (!profile) return '?'
    return profile.wallThicknessMm != null
      ? `${profile.widthMm}×${profile.wallThicknessMm}`
      : String(profile.widthMm)
  }).join('/')
  return t('paramsPanel.lamellaPatternOption', { widths })
}

function formatProfileOption(profileId: string): string {
  const profile = DEMO_PROFILES.get(profileId)
  const base = formatConstructionProfileLabel(profileId, profile)
  if (!profile) return base
  const traits: string[] = []
  if (profile.maxSpanMm) traits.push(`maxSpan ${profile.maxSpanMm}мм`)
  if (profile.maxLamellaSpanMm) traits.push(`maxSpan ${profile.maxLamellaSpanMm}мм`)
  if (profile.interruptsLamella) traits.push('перебивает ламель')
  if (profile.hasLedChannel) traits.push('LED')
  return traits.length > 0 ? `${base} — ${traits.join(', ')}` : base
}

