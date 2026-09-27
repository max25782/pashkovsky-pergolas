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
  computeFrame,
  computeLamellas,
  segmentBeamsForStock,
  segmentLedPurlinsForStock,
  validateLamellaSpans,
  DEFAULT_KERF_MM,
  DEFAULT_VISTUR_TOLERANCES,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  type PlanConstructionParams,
} from '@pashkovsky/pergola-core'
import type { CutPiece, PergolaSpec, Point2D, ProfileDimensions, StructuralIssue } from '@pashkovsky/pergola-core'
import { PergolaCutPieceViewer } from '@pashkovsky/pergola-3d-preview'
import type { Locale } from '@/lib/locales'
import type { Offer, PergolaPlan, PergolaPlanConstructionParams } from '@/types/offer'
import { authFetch } from '@/lib/api/auth-fetch'

const NO_PURLIN = ''

// Full catalog - same as debug page
const DEMO_PROFILES: Map<string, ProfileDimensions> = new Map([
  // Posts
  ['f8080', { widthMm: 80, heightMm: 80, availableStockLengthsMm: [4000, 6000] }],
  ['f6060', { widthMm: 60, heightMm: 60, availableStockLengthsMm: [4000, 6000] }],
  // Beams
  ['f10040', { widthMm: 40, heightMm: 100, maxSpanMm: 5000, availableStockLengthsMm: [6000, 7000] }],
  ['f12050', { widthMm: 50, heightMm: 120, maxSpanMm: 6000, availableStockLengthsMm: [6000, 7000, 8000] }],
  // Lamellas
  ['f2020', { widthMm: 20, heightMm: 20, maxLamellaSpanMm: 1500, availableStockLengthsMm: [6000] }],
  ['f4020', { widthMm: 40, heightMm: 20, maxLamellaSpanMm: 1500, availableStockLengthsMm: [6000] }],
  ['f7020', { widthMm: 70, heightMm: 20, maxLamellaSpanMm: 1500, availableStockLengthsMm: [6000] }],
  // Purlins
  ['purlin-plain-5030', { widthMm: 30, heightMm: 50, maxSpanMm: 3000, interruptsLamella: false, availableStockLengthsMm: [6000] }],
  ['purlin-led-6040', { widthMm: 40, heightMm: 60, maxSpanMm: 3000, interruptsLamella: true, ledChannelWidthMm: 12, ledMaxStockLengthMm: 5000, availableStockLengthsMm: [6000] }],
])

interface LamellaPatternPreset {
  id: string
  pattern: string[]
}

const LAMELLA_PATTERN_PRESETS: LamellaPatternPreset[] = [
  { id: 'all-20', pattern: ['f2020'] },
  { id: 'all-40', pattern: ['f4020'] },
  { id: 'all-70', pattern: ['f7020'] },
  { id: 'mixed-70-40', pattern: ['f7020', 'f4020'] },
  { id: 'mixed-70-40-20', pattern: ['f7020', 'f4020', 'f2020'] },
]

function getLamellaPatternPreset(id: string): LamellaPatternPreset {
  return LAMELLA_PATTERN_PRESETS.find((p) => p.id === id) ?? LAMELLA_PATTERN_PRESETS[0]
}

const BEAM_PROFILE_IDS = ['f10040', 'f12050']
const PURLIN_PROFILE_IDS = ['purlin-plain-5030', 'purlin-led-6040']
const POST_PROFILE_IDS = ['f8080', 'f6060']

type ConstructionParams = PlanConstructionParams

const DEFAULT_PARAMS: ConstructionParams = DEFAULT_PLAN_CONSTRUCTION_PARAMS

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
    lamellaProfileId: pattern[0],
    lamellaPattern: [...pattern],
    purlinProfileId: params.purlinProfileId || undefined,
    wallEdgeIndices,
    color: '#9aa0a6',
    visturTolerances: params.visturMode ? DEFAULT_VISTUR_TOLERANCES : undefined,
  }
}

interface BuiltPieces {
  pieces: CutPiece[]
  isOrthogonal: boolean
}

function buildPieces(contourMm: Point2D[], wallEdgeIndices: number[], params: ConstructionParams): BuiltPieces {
  const spec = buildSpec(contourMm, wallEdgeIndices, params)
  const frame = computeFrame(spec, DEMO_PROFILES)
  const lamellas = computeLamellas(spec, DEMO_PROFILES)

  // LED purlins + dividers
  const ledResult = segmentLedPurlinsForStock(spec, DEMO_PROFILES, frame.posts, frame.beams, DEFAULT_KERF_MM)
  const purlins = [...ledResult.purlins, ...ledResult.dividers]

  // Beam segmentation
  const beamResult = segmentBeamsForStock(spec, frame, [...lamellas, ...purlins], DEMO_PROFILES, DEFAULT_KERF_MM)

  // Validation
  const structuralIssues = validateLamellaSpans(lamellas, DEMO_PROFILES)
  if (structuralIssues.length > 0) {
    throw new Error(summarizeStructuralIssues(structuralIssues))
  }
  if (beamResult.issues.length > 0 || ledResult.issues.length > 0) {
    const lines = [
      ...beamResult.issues.map((i) => `  beam "${i.pieceId}" (profile "${i.profileId}"): ${i.message}`),
      ...ledResult.issues.map((i) => `  LED purlin (profile "${i.profileId}"): ${i.message}`),
    ]
    throw new Error(`Construction gap — cannot fit onto any available stock:\n${lines.join('\n')}`)
  }

  return {
    pieces: [...beamResult.beams, ...beamResult.posts, ...lamellas, ...purlins],
    isOrthogonal: frame.isOrthogonal,
  }
}

function summarizeStructuralIssues(issues: StructuralIssue[]): string {
  const lines = issues.map((issue) => {
    const span = issue.spanMm
    const limit = issue.maxSpanMm
    return `  profile "${issue.profileId}": ${span}mm unsupported (limit ${limit}mm)`
  })
  return (
    `Structural violation — ${issues.length} lamella piece(s) exceed their profile's maxLamellaSpanMm:\n` +
    `${lines.join('\n')}\n` +
    `Add a purlin profile with interruptsLamella: true, or a lamella profile rated for this span.`
  )
}

export interface OfferPlanConfiguratorEmbedHandle {
  captureScreenshot: () => string | null
  /** Persists current plan polygon + params to the offer (required before PDF). */
  savePlanToOffer: () => Promise<boolean>
}

export interface PlanGeometryChange extends PlanContourSnapshot {
  params: PergolaPlanConstructionParams
  /** False when post/beam layout is approximate (non-axis-aligned contour). */
  isOrthogonal: boolean
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
}

export const OfferPlanConfiguratorEmbed = forwardRef<
  OfferPlanConfiguratorEmbedHandle,
  OfferPlanConfiguratorEmbedProps
>(function OfferPlanConfiguratorEmbed(
  { offerId, locale, offer, onSaved, onPlanGeometry, canvasClassName, initialPlan },
  ref,
) {
  const t = useTranslations('planEditor')

  const [params, setParams] = useState<ConstructionParams>(initialPlan?.params ?? DEFAULT_PARAMS)
  const [paramsOpen, setParamsOpen] = useState(false)
  const [lastPolygonMm, setLastPolygonMm] = useState<Point[] | null>(null)
  const [lastWallEdgeIndices, setLastWallEdgeIndices] = useState<number[]>([])
  const [preview3DOpen, setPreview3DOpen] = useState(false)
  const [preview3DError, setPreview3DError] = useState<string | null>(null)
  const [isBuilding3D, setIsBuilding3D] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Load saved polygon from offer
  useEffect(() => {
    const meta = offer?.configuratorMeta as any
    if (meta?.planPolygon && meta?.planParams) {
      const savedPolygon = meta.planPolygon as Point[]
      const savedIndices = (meta.planWallIndices as number[]) || []
      const savedParams = meta.planParams as ConstructionParams
      setLastPolygonMm(savedPolygon)
      setLastWallEdgeIndices(savedIndices)
      setParams(savedParams)
    }
  }, [offer])

  const savePlanToServer = useCallback(
    async (polygonMm: Point[], wallEdgeIndices: number[]): Promise<boolean> => {
      if (!offerId) return false
      const res = await authFetch(`/api/offers/${offerId}/configurator-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planPolygon: polygonMm,
          planWallIndices: wallEdgeIndices,
          planParams: params,
          locale,
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      onSaved?.()
      return true
    },
    [offerId, params, locale, onSaved],
  )

  useImperativeHandle(
    ref,
    () => ({
      captureScreenshot: () => {
        // TODO: Implement screenshot capture from 3D view or plan canvas
        return null
      },
      savePlanToOffer: async () => {
        if (!offerId || !lastPolygonMm || lastPolygonMm.length < 3) return false
        return savePlanToServer(lastPolygonMm, lastWallEdgeIndices)
      },
    }),
    [offerId, lastPolygonMm, lastWallEdgeIndices, savePlanToServer],
  )

  const handleTo3D = useCallback(
    (polygonMm: Point[], wallEdgeIndices: number[]) => {
      console.log('[planEditor→3D] polygon:', polygonMm.length, 'vertices', polygonMm, 'wallEdgeIndices:', wallEdgeIndices)

      setPreview3DError(null)
      setIsBuilding3D(true)

      setTimeout(() => {
        try {
          const contour: Point2D[] = polygonMm.map((p): Point2D => [p.x, p.y])
          const built = buildPieces(contour, wallEdgeIndices, params)
          console.log('[planEditor→3D] computed →', built.pieces.length, 'CutPiece')

          setLastPolygonMm(polygonMm)
          setLastWallEdgeIndices(wallEdgeIndices)
          setPreview3DOpen(true)
          if (offerId) {
            void savePlanToServer(polygonMm, wallEdgeIndices).catch((err) => {
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
    [params, savePlanToServer, offerId],
  )

  const measureOrthogonal = useCallback(
    (polygonMm: Point[], wallEdgeIndices: number[]): boolean => {
      if (polygonMm.length < 3) return true
      try {
        const contour: Point2D[] = polygonMm.map((p): Point2D => [p.x, p.y])
        return buildPieces(contour, wallEdgeIndices, params).isOrthogonal
      } catch {
        return true
      }
    },
    [params],
  )

  const onPlanGeometryRef = useRef(onPlanGeometry)
  onPlanGeometryRef.current = onPlanGeometry

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
      onPlanGeometryRef.current?.({ ...contour, params, isOrthogonal })
    },
    [params, measureOrthogonal],
  )

  const buildResult = useMemo(() => {
    if (!lastPolygonMm) return { pieces: null, error: null, isOrthogonal: true }
    try {
      const contour: Point2D[] = lastPolygonMm.map((p): Point2D => [p.x, p.y])
      const built = buildPieces(contour, lastWallEdgeIndices, params)
      return { pieces: built.pieces, error: null, isOrthogonal: built.isOrthogonal }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { pieces: null, error: message, isOrthogonal: true }
    }
  }, [lastPolygonMm, lastWallEdgeIndices, params])

  useEffect(() => {
    if (lastPolygonMm) setPreview3DError(buildResult.error)
  }, [buildResult.error, lastPolygonMm])

  useEffect(() => {
    if (lastPolygonMm) setPreview3DError(buildResult.error)
  }, [buildResult.error, lastPolygonMm])

  const handleSave = useCallback(async () => {
    if (!lastPolygonMm) return

    setIsSaving(true)
    try {
      await savePlanToServer(lastPolygonMm, lastWallEdgeIndices)
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

  return (
    <div className="flex h-full w-full flex-col gap-3">
      {/* Header with params button and save */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setParamsOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
        >
          <span aria-hidden="true">⚙️</span>
          {t('paramsPanel.toggleOpenButton')}
        </button>

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
        <ConstructionParamsPanel params={params} onChange={setParams} t={t} />
      </ParamsDrawer>

      {/* Plan editor canvas */}
      <div
        className={
          canvasClassName ??
          'relative min-h-[700px] w-full flex-1 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900'
        }
      >
        <PlanEditor
          labels={labels}
          onTo3D={handleTo3D}
          onContourChange={handleContourChange}
          initialContour={
            initialPlan && initialPlan.polygon.length >= 3
              ? { polygon: initialPlan.polygon, wallIndices: initialPlan.wallIndices }
              : undefined
          }
        />
      </div>

      {/* Building indicator */}
      {isBuilding3D && (
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent dark:border-neutral-500" />
          {t('preview3D.building')}
        </div>
      )}

      {/* Error display */}
      {preview3DError && (
        <div className="whitespace-pre-line rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
          {preview3DError}
        </div>
      )}

      {/* 3D Preview modal */}
      {preview3DOpen && buildResult.pieces && (
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
              <PergolaCutPieceViewer pieces={buildResult.pieces} profiles={DEMO_PROFILES} />
            </div>
          </div>
        </div>
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

interface ConstructionParamsPanelProps {
  params: ConstructionParams
  onChange: (params: ConstructionParams) => void
  t: ReturnType<typeof useTranslations>
}

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

function formatPatternOption(preset: LamellaPatternPreset, t: ReturnType<typeof useTranslations>): string {
  const widths = preset.pattern.map((id) => DEMO_PROFILES.get(id)?.widthMm ?? '?').join('/')
  return t('paramsPanel.lamellaPatternOption', { widths })
}

function formatProfileOption(profileId: string): string {
  const profile = DEMO_PROFILES.get(profileId)
  if (!profile) return profileId
  return `${profileId} (${profile.widthMm}×${profile.heightMm} mm)`
}
