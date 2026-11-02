'use client'

import {
  useCallback,
  useState,
  useMemo,
  useEffect,
  useImperativeHandle,
  useRef,
  forwardRef,
  type ReactNode,
} from 'react'
import { useTranslations } from 'next-intl'
import { PlanEditor, type PlanContourSnapshot, type PlanEditorLabels, type Point } from '@pashkovsky/plan-editor'
import {
  buildDividerPickPieces,
  buildPiecesFromPlan,
  logDividerPickingDiagnostics,
  resolvePlanPurlinLines,
  beamProfileChangePatch,
  beamPlanWidthForDrawing,
  contourAxesMatchEnteredOuters,
  contourSideWidthMm,
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
  paramsFromStoredPlan,
  isRetiredProfileId,
  computeLedStripLengthMm,
  type PlanConstructionParams,
} from '@pashkovsky/pergola-core'
import type { Point2D } from '@pashkovsky/pergola-core'
import { PergolaCutPieceViewer } from '@pashkovsky/pergola-3d-preview'
import { LamellaWallThicknessField } from '@/components/offers/LamellaWallThicknessField'
import { RoofSlopeFields } from '@/components/offers/RoofSlopeFields'
import { Plan3DDividerControls } from '@/components/offers/Plan3DDividerControls'
import {
  SupportBeamControls,
  placeSupportBeamAtPlanPoint,
  supportBeamWarningMessages,
} from '@/components/offers/SupportBeamControls'
import { PlanDrawingSheetsModal } from '@/components/offers/PlanDrawingSheetsModal'
import { ReplaceProfileNotice } from '@/components/offers/ReplaceProfileNotice'
import { PlanBuildErrorPanel } from '@/components/offers/PlanBuildErrorPanel'
import {
  computeStockComparisons,
  formatPlanProfileOption,
  PlanPieceSummary,
  PlanStockComparisonTable,
} from '@/components/offers/plan-pieces-summary'
import type { Locale } from '@/lib/locales'
import type { Offer, PergolaPlan, PergolaPlanConstructionParams } from '@/types/offer'
import { authFetch } from '@/lib/api/auth-fetch'

const NO_PURLIN = ''

const DEMO_PROFILES = PERGOLA_CONSTRUCTION_PROFILES

const BEAM_PROFILE_IDS = CONSTRUCTION_BEAM_IDS
const PURLIN_PROFILE_IDS = CONSTRUCTION_PURLIN_IDS
const POST_PROFILE_IDS = CONSTRUCTION_POST_IDS

type ConstructionParams = PlanConstructionParams

const DEFAULT_PARAMS: ConstructionParams = DEFAULT_PLAN_CONSTRUCTION_PARAMS

function buildHostPieces(
  contourMm: Point2D[],
  wallEdgeIndices: number[],
  params: ConstructionParams,
  supportBeams?: PergolaPlan['supportBeams'],
) {
  return buildPiecesFromPlan(
    {
      contour: contourMm,
      wallEdgeIndices,
      params,
      ...(supportBeams ? { supportBeams } : {}),
    },
    DEMO_PROFILES,
  )
}

function measureOrthogonalSafe(
  polygonMm: Point[],
  wallEdgeIndices: number[],
  planParams: ConstructionParams,
  supportBeams?: PergolaPlan['supportBeams'],
): boolean {
  if (polygonMm.length < 3) return true
  try {
    return buildHostPieces(
      polygonMm.map((point): Point2D => [point.x, point.y]),
      wallEdgeIndices,
      planParams,
      supportBeams,
    ).isOrthogonal
  } catch {
    return true
  }
}

export interface OfferPlanConfiguratorEmbedHandle {
  captureScreenshot: () => string | null
  /** Persists current plan polygon + params to the offer (required before PDF). */
  savePlanToOffer: () => Promise<boolean>
  /** Opens production drawing sheets modal (top plan, layout, order). */
  openDrawingSheets: () => Promise<void>
  /** Writes the current plan and returns the document the preview must read. */
  flushPlan: () => Promise<PlanFlushResult | null>
  replaceProfile: (field: 'purlinProfileId' | 'wingShelfProfileId', profileId: string) => void
}

export interface PlanFlushResult {
  ok: boolean
  polygon: Point[]
  wallIndices: number[]
  params: PergolaPlanConstructionParams
  isOrthogonal: boolean
  /** Top-level plan field; may be invalid raw JSON still awaiting a warning. */
  supportBeams?: PergolaPlan['supportBeams']
}

export interface PlanGeometryChange extends PlanContourSnapshot {
  params: PergolaPlanConstructionParams
  /** False when post/beam layout is approximate (non-axis-aligned contour). */
  isOrthogonal: boolean
  supportBeams?: PergolaPlan['supportBeams']
}

interface OfferPlanConfiguratorEmbedProps {
  /** When omitted, the editor only reports geometry via `onPlanGeometry` and does not call configurator-save. */
  offerId?: string
  locale: Locale
  offer?: Offer | null
  onSaved?: () => void
  onPlanGeometry?: (geometry: PlanGeometryChange) => void
  canvasClassName?: string
  /** Closed plan to show on mount (draft restore). Read once. */
  initialPlan?: PergolaPlan | null
  /** When false, use ref.openDrawingSheets() only (e.g. quick-offer “confirm drawing”). */
  showDrawingOpenButton?: boolean
}

export const OfferPlanConfiguratorEmbed = forwardRef<
  OfferPlanConfiguratorEmbedHandle,
  OfferPlanConfiguratorEmbedProps
>(function OfferPlanConfiguratorEmbed(
  {
    offerId,
    locale,
    offer,
    onSaved,
    onPlanGeometry,
    canvasClassName,
    initialPlan,
    showDrawingOpenButton = true,
  },
  ref,
) {
  const t = useTranslations('planEditor')

  const [params, setParams] = useState<ConstructionParams>(() =>
    initialPlan?.params ? paramsFromStoredPlan(initialPlan.params) : { ...DEFAULT_PARAMS },
  )
  const [supportBeams, setSupportBeams] = useState<PergolaPlan['supportBeams']>(
    () => initialPlan?.supportBeams,
  )
  const [supportBeamsUndo, setSupportBeamsUndo] = useState<Array<PergolaPlan['supportBeams']>>([])
  const [supportBeamsRedo, setSupportBeamsRedo] = useState<Array<PergolaPlan['supportBeams']>>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const commitSupportBeams = useCallback((next: PergolaPlan['supportBeams']) => {
    setSupportBeams((prev) => {
      setSupportBeamsUndo((stack) => [...stack.slice(-29), prev])
      setSupportBeamsRedo([])
      return next
    })
  }, [])

  const undoSupportBeams = useCallback(() => {
    setSupportBeamsUndo((stack) => {
      if (stack.length === 0) return stack
      const prev = stack[stack.length - 1]
      setSupportBeams((current) => {
        setSupportBeamsRedo((redo) => [...redo, current])
        return prev
      })
      return stack.slice(0, -1)
    })
  }, [])

  const redoSupportBeams = useCallback(() => {
    setSupportBeamsRedo((stack) => {
      if (stack.length === 0) return stack
      const next = stack[stack.length - 1]
      setSupportBeams((current) => {
        setSupportBeamsUndo((undo) => [...undo, current])
        return next
      })
      return stack.slice(0, -1)
    })
  }, [])
  const [paramsOpen, setParamsOpen] = useState(false)
  const [lastPolygonMm, setLastPolygonMm] = useState<Point[] | null>(null)
  const [lastWallEdgeIndices, setLastWallEdgeIndices] = useState<number[]>([])
  const [preview3DOpen, setPreview3DOpen] = useState(false)
  const [preview3DError, setPreview3DError] = useState<string | null>(null)
  const [isBuilding3D, setIsBuilding3D] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [drawingOpen, setDrawingOpen] = useState(false)
  const [selectedCanvasDividerId, setSelectedCanvasDividerId] = useState<string | null>(null)
  const [supportBeamPlaceMode, setSupportBeamPlaceMode] = useState(false)
  const [beamStartPurlinId, setBeamStartPurlinId] = useState<string | null>(null)

  // Load saved polygon from offer
  useEffect(() => {
    const meta = offer?.configuratorMeta as Record<string, unknown> | null | undefined
    if (meta?.planPolygon && meta?.planParams) {
      const savedPolygon = meta.planPolygon as Point[]
      const savedIndices = (meta.planWallIndices as number[]) || []
      const savedParams = meta.planParams as ConstructionParams
      setLastPolygonMm(savedPolygon)
      setLastWallEdgeIndices(savedIndices)
      setParams(paramsFromStoredPlan(savedParams))
      const fromPlan =
        meta.plan && typeof meta.plan === 'object'
          ? (meta.plan as { supportBeams?: PergolaPlan['supportBeams'] }).supportBeams
          : undefined
      const fromMeta = meta.supportBeams as PergolaPlan['supportBeams'] | undefined
      if (fromPlan !== undefined || fromMeta !== undefined) {
        setSupportBeams(fromPlan ?? fromMeta)
      }
    }
  }, [offer])

  const paramsRef = useRef(params)
  const polygonRef = useRef(lastPolygonMm)
  const wallsRef = useRef(lastWallEdgeIndices)
  const supportBeamsRef = useRef(supportBeams)
  const saveGeneration = useRef(0)
  const onPlanGeometryRef = useRef(onPlanGeometry)
  paramsRef.current = params
  polygonRef.current = lastPolygonMm
  wallsRef.current = lastWallEdgeIndices
  supportBeamsRef.current = supportBeams
  onPlanGeometryRef.current = onPlanGeometry

  const savePlanToServer = useCallback(
    async (
      polygonMm: Point[],
      wallEdgeIndices: number[],
      planParams: ConstructionParams,
      beams: PergolaPlan['supportBeams'] = supportBeamsRef.current,
    ): Promise<PlanFlushResult> => {
      const isOrthogonal = measureOrthogonalSafe(polygonMm, wallEdgeIndices, planParams, beams)
      if (!offerId) {
        return {
          ok: true,
          polygon: polygonMm,
          wallIndices: wallEdgeIndices,
          params: planParams,
          isOrthogonal,
          supportBeams: beams,
        }
      }
      const planDoc = {
        schemaVersion: 1,
        polygon: polygonMm,
        wallIndices: wallEdgeIndices,
        params: planParams,
        confirmed: false,
        ...(beams !== undefined ? { supportBeams: beams } : {}),
      }
      const res = await authFetch(`/api/offers/${offerId}/configurator-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planPolygon: polygonMm,
          planWallIndices: wallEdgeIndices,
          planParams,
          supportBeams: beams ?? null,
          plan: planDoc,
          locale,
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const body = (await res.json()) as {
        planParams?: ConstructionParams
        planPolygon?: Point[]
        planWallIndices?: number[]
        supportBeams?: PergolaPlan['supportBeams'] | null
      }
      onSaved?.()
      const readParams = body.planParams ? paramsFromStoredPlan(body.planParams) : planParams
      const readBeams =
        body.supportBeams === null ? undefined : (body.supportBeams ?? beams)
      return {
        ok: true,
        polygon: body.planPolygon ?? polygonMm,
        wallIndices: body.planWallIndices ?? wallEdgeIndices,
        params: readParams,
        isOrthogonal,
        supportBeams: readBeams,
      }
    },
    [offerId, locale, onSaved],
  )

  const publishGeometry = useCallback((
    planParams: ConstructionParams,
    polygon: Point[],
    walls: number[],
    beams: PergolaPlan['supportBeams'] = supportBeamsRef.current,
  ) => {
    onPlanGeometryRef.current?.({
      polygon,
      wallIndices: walls,
      isClosed: true,
      isSimple: true,
      params: planParams,
      isOrthogonal: measureOrthogonalSafe(polygon, walls, planParams, beams),
      supportBeams: beams,
    })
  }, [])

  const flushPlan = useCallback(async (): Promise<PlanFlushResult | null> => {
    const polygon = polygonRef.current
    const walls = wallsRef.current
    const planParams = paramsRef.current
    const beams = supportBeamsRef.current
    if (!polygon || polygon.length < 3) return null
    publishGeometry(planParams, polygon, walls, beams)
    const gen = saveGeneration.current
    try {
      const saved = await savePlanToServer(polygon, walls, planParams, beams)
      if (saveGeneration.current !== gen) {
        const latestPolygon = polygonRef.current ?? polygon
        const latestWalls = wallsRef.current
        const latestParams = paramsRef.current
        const latestBeams = supportBeamsRef.current
        return {
          ok: true,
          polygon: latestPolygon,
          wallIndices: latestWalls,
          params: latestParams,
          isOrthogonal: measureOrthogonalSafe(latestPolygon, latestWalls, latestParams, latestBeams),
          supportBeams: latestBeams,
        }
      }
      if (JSON.stringify(saved.params) !== JSON.stringify(planParams)) setParams(saved.params)
      if (JSON.stringify(saved.supportBeams) !== JSON.stringify(beams)) setSupportBeams(saved.supportBeams)
      setLastPolygonMm(saved.polygon)
      setLastWallEdgeIndices(saved.wallIndices)
      setSaveStatus('saved')
      return saved
    } catch (error) {
      console.error('[plan auto-save]', error)
      setSaveStatus('error')
      return {
        ok: false,
        polygon,
        wallIndices: walls,
        params: planParams,
        isOrthogonal: measureOrthogonalSafe(polygon, walls, planParams, beams),
        supportBeams: beams,
      }
    }
  }, [publishGeometry, savePlanToServer])

  useImperativeHandle(
    ref,
    () => ({
      captureScreenshot: () => {
        return null
      },
      savePlanToOffer: async () => {
        const flushed = await flushPlan()
        return flushed?.ok === true
      },
      openDrawingSheets: async () => {
        await flushPlan()
        setDrawingOpen(true)
      },
      flushPlan,
      replaceProfile: (field, profileId) => {
        setParams((prev) => ({ ...prev, [field]: profileId }))
      },
    }),
    [flushPlan],
  )

  const handleTo3D = useCallback(
    (polygonMm: Point[], wallEdgeIndices: number[]) => {
      console.log('[planEditor→3D] polygon:', polygonMm.length, 'vertices', polygonMm, 'wallEdgeIndices:', wallEdgeIndices)

      setPreview3DError(null)
      setIsBuilding3D(true)

      setTimeout(() => {
        try {
          const contour: Point2D[] = polygonMm.map((p): Point2D => [p.x, p.y])
          const built = buildHostPieces(contour, wallEdgeIndices, params, supportBeams)
          console.log('[planEditor→3D] computed →', built.pieces.length, 'CutPiece')

          setLastPolygonMm(polygonMm)
          setLastWallEdgeIndices(wallEdgeIndices)
          setPreview3DOpen(true)
          if (offerId) {
            void savePlanToServer(polygonMm, wallEdgeIndices, params).catch((err) => {
              console.error('[plan auto-save]', err)
            })
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error('[planEditor→3D] pipeline failed:', err)
          setPreview3DOpen(false)
          setPreview3DError(message)
        } finally {
          setIsBuilding3D(false)
        }
      }, 0)
    },
    [params, savePlanToServer, offerId, supportBeams],
  )

  const measureOrthogonal = useCallback(
    (polygonMm: Point[], wallEdgeIndices: number[]): boolean => {
      if (polygonMm.length < 3) return true
      try {
        const contour: Point2D[] = polygonMm.map((p): Point2D => [p.x, p.y])
        return buildHostPieces(contour, wallEdgeIndices, params, supportBeams).isOrthogonal
      } catch {
        return true
      }
    },
    [params, supportBeams],
  )

  const handleContourChange = useCallback(
    (contour: PlanContourSnapshot) => {
      if (contour.isClosed && contour.polygon.length >= 3) {
        setLastPolygonMm(contour.polygon)
        setLastWallEdgeIndices(contour.wallIndices)
      }
      const isOrthogonal =
        contour.isClosed && contour.polygon.length >= 3
          ? measureOrthogonal(contour.polygon, contour.wallIndices)
          : true
      const nextParams = {
        ...params,
        ...(contour.measuredOuterLengthMmByEdgeIndex
          ? { measuredOuterLengthMmByEdgeIndex: contour.measuredOuterLengthMmByEdgeIndex }
          : {}),
      }
      if (contour.measuredOuterLengthMmByEdgeIndex) {
        setParams(nextParams)
      }
      onPlanGeometryRef.current?.({
        ...contour,
        params: nextParams,
        isOrthogonal,
        supportBeams: supportBeamsRef.current,
      })
    },
    [params, measureOrthogonal],
  )

  // Persist / publish supportBeams the same way params do (round-trip must not drop them).
  const skipBeamPublish = useRef(true)
  useEffect(() => {
    if (skipBeamPublish.current) {
      skipBeamPublish.current = false
      return
    }
    const polygon = polygonRef.current
    const walls = wallsRef.current
    if (!polygon || polygon.length < 3) return
    publishGeometry(paramsRef.current, polygon, walls, supportBeams)
    setSaveStatus('saving')
    const gen = ++saveGeneration.current
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const saved = await savePlanToServer(polygon, walls, paramsRef.current, supportBeams)
          if (saveGeneration.current !== gen) return
          if (JSON.stringify(saved.supportBeams) !== JSON.stringify(supportBeamsRef.current)) {
            setSupportBeams(saved.supportBeams)
          }
          setSaveStatus('saved')
        } catch (error) {
          console.error('[plan auto-save beams]', error)
          if (saveGeneration.current === gen) setSaveStatus('error')
        }
      })()
    }, 500)
    return () => window.clearTimeout(timer)
  }, [supportBeams, publishGeometry, savePlanToServer])

  const skipParamPublish = useRef(true)
  useEffect(() => {
    if (skipParamPublish.current) {
      skipParamPublish.current = false
      return
    }
    const polygon = polygonRef.current
    const walls = wallsRef.current
    if (!polygon || polygon.length < 3) return
    publishGeometry(params, polygon, walls)
    setSaveStatus('saving')
    const gen = ++saveGeneration.current
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const saved = await savePlanToServer(polygon, walls, params)
          if (saveGeneration.current !== gen) return
          if (JSON.stringify(saved.params) !== JSON.stringify(paramsRef.current)) setParams(saved.params)
          setSaveStatus('saved')
        } catch (error) {
          console.error('[plan auto-save]', error)
          if (saveGeneration.current === gen) setSaveStatus('error')
        }
      })()
    }, 500)
    return () => window.clearTimeout(timer)
  }, [params, publishGeometry, savePlanToServer])

  const buildResult = useMemo(() => {
    if (!lastPolygonMm) {
      return { pieces: null, structuralPurlins: [], error: null, isOrthogonal: true, roofWarning: null, warnings: [] }
    }
    try {
      const contour: Point2D[] = lastPolygonMm.map((p): Point2D => [p.x, p.y])
      const built = buildHostPieces(contour, lastWallEdgeIndices, params, supportBeams)
      return {
        pieces: built.pieces,
        structuralPurlins: built.structuralPurlins,
        error: null,
        isOrthogonal: built.isOrthogonal,
        roofWarning: built.roof.warning,
        warnings: built.warnings,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { pieces: null, structuralPurlins: [], error: message, isOrthogonal: true, roofWarning: null, warnings: [] }
    }
  }, [lastPolygonMm, lastWallEdgeIndices, params, supportBeams])

  const preview3DPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (lastPolygonMm) setPreview3DError(buildResult.error)
  }, [buildResult.error, lastPolygonMm])

  useEffect(() => {
    if (!preview3DOpen || !buildResult.pieces) return
    preview3DPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [preview3DOpen, buildResult.pieces])

  const dividerPickPieces = useMemo(() => {
    if (!lastPolygonMm || lastPolygonMm.length < 3) return []
    const contour = lastPolygonMm.map((p): Point2D => [p.x, p.y])
    return buildDividerPickPieces(contour, params, DEMO_PROFILES)
  }, [lastPolygonMm, params])

  useEffect(() => {
    if (!preview3DOpen || !buildResult.pieces || !lastPolygonMm) return
    const contour = lastPolygonMm.map((p): Point2D => [p.x, p.y])
    logDividerPickingDiagnostics(
      contour,
      params,
      DEMO_PROFILES,
      buildResult.structuralPurlins,
      buildResult.pieces.filter((p) => p.role === 'purlin'),
    )
  }, [preview3DOpen, buildResult.pieces, buildResult.structuralPurlins, lastPolygonMm, params])

  const ledStripLengthMm = useMemo(
    () => (buildResult.pieces ? computeLedStripLengthMm(buildResult.pieces, DEMO_PROFILES) : 0),
    [buildResult.pieces],
  )

  const stockComparisons = useMemo(
    () => (buildResult.pieces ? computeStockComparisons(buildResult.pieces, DEMO_PROFILES) : []),
    [buildResult.pieces],
  )

  const handleSave = useCallback(async () => {
    if (!lastPolygonMm) return

    setIsSaving(true)
    try {
      await savePlanToServer(lastPolygonMm, lastWallEdgeIndices, params)
    } catch (e) {
      console.error('[plan save]', e)
      alert(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }, [lastPolygonMm, lastWallEdgeIndices, savePlanToServer])

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

  const canvasFrameClass =
    'relative min-h-0 w-full flex-1 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900'
  const defaultCanvasClass = `${canvasFrameClass} h-full min-h-[min(50dvh,520px)]`
  const planEditorPaneClass = canvasClassName ?? defaultCanvasClass

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-3">
      {/* Header with params button and save */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setParamsOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          >
            <span aria-hidden="true">⚙️</span>
            {t('paramsPanel.toggleOpenButton')}
          </button>
          {saveStatus !== 'idle' && (
            <span data-testid="save-status" className="text-xs font-medium text-neutral-500">
              {saveStatus === 'saving'
                ? t('paramsPanel.saveSaving')
                : saveStatus === 'error'
                  ? t('paramsPanel.saveError')
                  : t('paramsPanel.saveSaved')}
            </span>
          )}
          {showDrawingOpenButton && buildResult.pieces && (
            <button
              type="button"
              onClick={() => {
                void flushPlan().finally(() => setDrawingOpen(true))
              }}
              className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
            >
              <span aria-hidden="true">📐</span>
              {t('drawing.openButton')}
            </button>
          )}
        </div>

        {offerId && lastPolygonMm && (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        )}
      </div>

      <ParamsDrawer open={paramsOpen} onClose={() => setParamsOpen(false)} t={t}>
        <ConstructionParamsPanel
          params={params}
          onChange={setParams}
          t={t}
          contourMm={lastPolygonMm}
          wallEdgeIndices={lastWallEdgeIndices}
          ledStripLengthMm={ledStripLengthMm}
          longDivider={hasLongDividerWithoutSupport(
            (buildResult.pieces ?? [])
              .filter((piece) => piece.role === 'purlin' && piece.dividerId !== WING_SHELF_SPAN_DIVIDER_ID)
              .map((piece) => piece.lengthAxisMm),
            params.purlinMaxSpanMm,
          )}
        />
      </ParamsDrawer>

      <div className={`min-h-[min(50dvh,520px)] min-h-0 w-full flex-1 ${planEditorPaneClass}`}>
        <PlanEditor
          labels={labels}
          onTo3D={handleTo3D}
          onContourChange={handleContourChange}
          initialContour={
            initialPlan && initialPlan.polygon.length >= 3
              ? {
                  polygon: initialPlan.polygon,
                  wallIndices: initialPlan.wallIndices,
                  measuredOuterLengthMmByEdgeIndex: initialPlan.params.measuredOuterLengthMmByEdgeIndex,
                }
              : undefined
          }
          construction={{
            params,
            profiles: DEMO_PROFILES,
            selectedDividerId: selectedCanvasDividerId,
            onSelectDivider: setSelectedCanvasDividerId,
          }}
        />
      </div>

      {preview3DOpen && buildResult.pieces && (
        <div
          ref={preview3DPanelRef}
          className="flex h-auto w-full min-w-0 shrink-0 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white dark:bg-neutral-900"
        >
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
            <p className="border-b border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {buildResult.roofWarning}
            </p>
          )}
          <SupportBeamControls
            contour={(lastPolygonMm ?? []).map((p): Point2D => [p.x, p.y])}
            wallEdgeIndices={lastWallEdgeIndices}
            params={params}
            profiles={DEMO_PROFILES}
            supportBeams={supportBeams}
            pieces={buildResult.pieces}
            onChange={(next) => commitSupportBeams(next)}
            onUndo={undoSupportBeams}
            onRedo={redoSupportBeams}
            canUndo={supportBeamsUndo.length > 0}
            canRedo={supportBeamsRedo.length > 0}
            placeMode={supportBeamPlaceMode}
            onPlaceModeChange={setSupportBeamPlaceMode}
            t={t}
          />
          <Plan3DDividerControls
            contour={(lastPolygonMm ?? []).map((p): Point2D => [p.x, p.y])}
            params={params}
            profiles={DEMO_PROFILES}
            warnings={buildResult.warnings}
            dividerIds={
              lastPolygonMm && lastPolygonMm.length >= 3
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
                pieces={buildResult.pieces}
                profiles={DEMO_PROFILES}
                colorHex={params.colorHex}
                dividerHitPieces={dividerPickPieces}
                {...bind}
                addDividerActive={supportBeamPlaceMode || bind.addDividerActive}
                onAddDividerAt={(planXMm, planYMm) => {
                  if (supportBeamPlaceMode && lastPolygonMm) {
                    const contour = lastPolygonMm.map((p): Point2D => [p.x, p.y])
                    const lines = resolvePlanPurlinLines(contour, params, DEMO_PROFILES, lastWallEdgeIndices)
                    const fromDoc =
                      supportBeams &&
                      typeof supportBeams === 'object' &&
                      Array.isArray((supportBeams as { beams?: unknown }).beams)
                        ? (supportBeams as { beams: Array<{ start?: { purlinId?: string } }> }).beams[0]
                            ?.start?.purlinId
                        : undefined
                    const startId = beamStartPurlinId ?? fromDoc
                    const line = lines.find((l) => l.id === startId) ?? lines[4] ?? lines[0]
                    if (line) {
                      setBeamStartPurlinId(line.id)
                      commitSupportBeams(
                        placeSupportBeamAtPlanPoint({
                          planXMm,
                          planYMm,
                          contour,
                          params,
                          profiles: DEMO_PROFILES,
                          startPurlinId: line.id,
                          startPurlinPositionMm: line.positionMm,
                        }),
                      )
                      setSupportBeamPlaceMode(false)
                      return
                    }
                  }
                  bind.onAddDividerAt(planXMm, planYMm)
                }}
              />
            )}
          </Plan3DDividerControls>
          <div className="max-h-48 shrink-0 overflow-y-auto border-t border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">
            <PlanPieceSummary
              pieces={buildResult.pieces}
              ledStripLengthMm={ledStripLengthMm}
              profiles={DEMO_PROFILES}
            />
            <PlanStockComparisonTable comparisons={stockComparisons} />
          </div>
        </div>
      )}

      {buildResult.pieces && (
        <PlanDrawingSheetsModal
          open={drawingOpen}
          onClose={() => setDrawingOpen(false)}
          pieces={buildResult.pieces}
          profiles={DEMO_PROFILES}
          planContour={lastPolygonMm?.map((p): [number, number] => [p.x, p.y])}
          wallEdgeIndices={lastWallEdgeIndices}
          constructionParams={params}
          supportBeams={
            supportBeams && typeof supportBeams === 'object' && 'formatVersion' in supportBeams
              ? (supportBeams as import('@pashkovsky/pergola-core').SupportBeamsDocument)
              : undefined
          }
          supportBeamWarningTexts={
            lastPolygonMm
              ? supportBeamWarningMessages({
                  contour: lastPolygonMm.map((p): Point2D => [p.x, p.y]),
                  wallEdgeIndices: lastWallEdgeIndices,
                  params,
                  profiles: DEMO_PROFILES,
                  supportBeams,
                })
              : []
          }
          lamellaDirectionDeg={params.lamellaDirectionDeg}
          isOrthogonal={buildResult.isOrthogonal}
          lamellaOnEdge={params.lamellaOnEdge}
          visturMode={params.visturMode}
          exportBlocked={saveStatus === 'error'}
          beforePrint={async () => (await flushPlan())?.ok === true}
          onReplaceProfile={(field, profileId) => {
            setParams((prev) => ({ ...prev, [field]: profileId }))
          }}
        />
      )}

      {/* Building indicator */}
      {isBuilding3D && (
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent dark:border-neutral-500" />
          {t('preview3D.building')}
        </div>
      )}

      {preview3DError && (
        <PlanBuildErrorPanel
          message={preview3DError}
          purlinProfileId={params.purlinProfileId}
          purlinInterruptsLamella={DEMO_PROFILES.get(params.purlinProfileId)?.interruptsLamella === true}
          title={t('preview3D.buildErrorTitle')}
          confirmNote={t('preview3D.buildErrorConfirmNote')}
          hintNoPurlin={t('preview3D.buildErrorHintNoPurlin')}
          hintNonInterrupt={t('preview3D.buildErrorHintNonInterrupt')}
          hintDefault={t('preview3D.buildErrorHintDefault')}
          showDetailsLabel={(count) => t('preview3D.buildErrorShowDetails', { count })}
          hideDetailsLabel={t('preview3D.buildErrorHideDetails')}
        />
      )}

    </div>
  )
})

interface ParamsDrawerProps {
  open: boolean
  onClose: () => void
  t: ReturnType<typeof useTranslations>
  children: ReactNode
}

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
  contourMm: Array<{ x: number; y: number }> | null
  wallEdgeIndices: number[]
  ledStripLengthMm: number
  longDivider?: boolean
}

function ConstructionParamsPanel({
  params,
  onChange,
  t,
  contourMm,
  wallEdgeIndices,
  ledStripLengthMm,
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
          {(isRetiredProfileId(params.beamProfileId) && !BEAM_PROFILE_IDS.includes(params.beamProfileId)
            ? [params.beamProfileId, ...BEAM_PROFILE_IDS]
            : BEAM_PROFILE_IDS
          ).map((id) => (
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
              {formatPlanProfileOption(id, DEMO_PROFILES)}{isRetiredProfileId(id) ? ' · ישן' : ''}
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
              label: formatPlanProfileOption(id, DEMO_PROFILES),
            }))}
            onChoose={(profileId) => patch({ purlinProfileId: profileId })}
          />
        )}
        {DEMO_PROFILES.get(params.purlinProfileId)?.hasLedChannel && ledStripLengthMm > 0 && (
          <span className="font-medium text-amber-700 dark:text-amber-400">
            {t('preview3D.ledStripLength', { meters: (ledStripLengthMm / 1000).toFixed(1) })}
          </span>
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
              {formatPlanProfileOption(id, DEMO_PROFILES)}
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
            options={supportProfileOptions.map((id) => ({
              id,
              label: formatPlanProfileOption(id, DEMO_PROFILES),
            }))}
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
  return formatConstructionProfileLabel(profileId, DEMO_PROFILES.get(profileId))
}
