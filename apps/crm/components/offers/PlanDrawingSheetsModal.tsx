'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { TopPlanSheet, LamellaLayoutSheet, LamellaSectionsSheet, CellFrameSheet, purlinEndsMeetFrame } from '@pashkovsky/pergola-drawing'
import {
  DEFAULT_VISTUR_TOLERANCES,
  buildLamellaSections,
  isLamellaSectionLayoutV1,
  resolveLamellaPatternIds,
  isRetiredProfileId,
  PERGOLA_CONSTRUCTION_PROFILES,
  specFromPlan,
  ANGLE_30_PROFILE_ID,
  angleProfileDimensions,
  buildAngleCutPieces,
  planFrameAsideRows,
  supportProfileNeedsChoice,
  supportProfileOptions,
  hasLongDividerWithoutSupport,
  WING_SHELF_SPAN_DIVIDER_ID,
  wallEdgeIndicesInFrameOrder,
  formatConstructionProfileLabel,
  CONSTRUCTION_PURLIN_IDS,
} from '@pashkovsky/pergola-core'
import type { CutPiece, ProfileDimensions, Point2D, PlanConstructionParams } from '@pashkovsky/pergola-core'
import { OrderAndCuttingPanel } from '@/components/cut-list/OrderAndCuttingPanel'
import { buildProfileBundlePlans, DEFAULT_KERF_MM, piecesForCutting } from '@/lib/cut-list/order-sheet'
import { renderCuttingPages, renderOrderPages, renderProductionSummary } from '@/lib/cut-list/cut-map'
import { downloadSheetPdf } from '@/components/offers/download-sheet-pdf'
import { ReplaceProfileNotice } from '@/components/offers/ReplaceProfileNotice'

function profilePhotoUrl(file: string): string {
  const path = `/profile-photo-check/photos/${file}`
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
}

export type PlanDrawingSheetId = 'plan' | 'lamellaLayout' | 'sections' | 'cellFrame' | 'orderCutting'

function purlinLengthGroups(pieces: CutPiece[]): Array<{ lengthMm: number; count: number }> {
  const groups = new Map<string, { lengthMm: number; count: number }>()
  for (const piece of pieces) {
    if (piece.role !== 'purlin' || piece.dividerId === WING_SHELF_SPAN_DIVIDER_ID) continue
    const lengthMm = Math.round(piece.lengthAxisMm * 10) / 10
    const key = lengthMm.toFixed(1)
    const existing = groups.get(key)
    if (existing) existing.count += 1
    else groups.set(key, { lengthMm, count: 1 })
  }
  return [...groups.values()].sort((a, b) => b.lengthMm - a.lengthMm)
}

function formatPurlinGroup(group: { lengthMm: number; count: number }): string {
  const label = Math.abs(group.lengthMm - Math.round(group.lengthMm)) < 0.05
    ? String(Math.round(group.lengthMm))
    : group.lengthMm.toFixed(1)
  return `${group.count} × ${label}`
}

function PlanProfileAside({
  contour,
  pieces,
  params,
  profiles,
  wallEdgeIndices,
  labels,
  dir,
  fontFamily,
}: {
  contour: Point2D[]
  pieces: CutPiece[]
  params: PlanConstructionParams
  profiles: Map<string, ProfileDimensions>
  wallEdgeIndices: number[]
  labels: {
    frame: string
    purlin: string
    lamella: string
    lit: string
    plain: string
    wall: string
    free: string
    purlinLengths: string
  }
  dir: 'rtl' | 'ltr'
  fontFamily: string
}) {
  const rows = planFrameAsideRows(contour.length, wallEdgeIndices, params, profiles)
  const purlin = profiles.get(params.purlinProfileId)
  const lengths = purlinLengthGroups(pieces)
  const lamellaMm = [
    ...new Set(
      resolveLamellaPatternIds(params.lamellaPatternId, params.lamellaWallThicknessMm)
        .map((id) => profiles.get(id)?.widthMm)
        .filter((mm): mm is number => mm != null && mm > 0),
    ),
  ]
  return (
    <aside dir={dir} style={{ fontFamily }} className="w-[220px] shrink-0 overflow-auto border-s border-neutral-200 bg-white p-3 text-sm text-neutral-900">
      <p className="font-semibold">{labels.frame}</p>
      <ul className="mt-1 space-y-1">
        {rows.map((row) => (
          <li key={`${row.wall ? 'wall' : 'free'}:${row.profileId}`}>
            {row.wall ? `${labels.frame}, ${labels.wall}` : labels.free}: <bdi dir="ltr">{row.size}</bdi>
          </li>
        ))}
      </ul>
      <p className="mt-3 font-semibold">{labels.purlin}</p>
      <p className="mt-1">{purlin?.hasLedChannel === true ? labels.lit : labels.plain}</p>
      {lengths.length > 0 && (
        <>
          <p className="mt-3 font-semibold text-amber-800">{labels.purlinLengths}</p>
          <ul className="mt-1 space-y-0.5 font-mono text-amber-900">
            {lengths.map((group) => (
              <li key={group.lengthMm}>{formatPurlinGroup(group)}</li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-3 font-semibold">{labels.lamella}</p>
      <p className="mt-1">{lamellaMm.map((mm) => Math.round(mm)).join(' / ')}</p>
    </aside>
  )
}

interface PlanDrawingSheetsModalProps {
  open: boolean
  onClose: () => void
  pieces: CutPiece[]
  profiles: Map<string, ProfileDimensions>
  isOrthogonal: boolean
  lamellaOnEdge: boolean
  visturMode: boolean
  planContour?: Point2D[]
  constructionParams?: PlanConstructionParams
  lamellaDirectionDeg?: number
  wallEdgeIndices?: number[]
  initialSheet?: PlanDrawingSheetId
  /** True when the last save failed. PDF buttons stay disabled. */
  exportBlocked?: boolean
  /** Writes the current plan and re-reads it before a PDF is built. */
  beforePrint?: () => Promise<boolean>
  onReplaceProfile?: (field: 'purlinProfileId' | 'wingShelfProfileId', profileId: string) => void
}

export function PlanDrawingSheetsModal({
  open,
  onClose,
  pieces,
  profiles,
  isOrthogonal,
  lamellaOnEdge,
  visturMode,
  planContour,
  constructionParams,
  lamellaDirectionDeg,
  wallEdgeIndices = [],
  initialSheet = 'plan',
  exportBlocked = false,
  beforePrint,
  onReplaceProfile,
}: PlanDrawingSheetsModalProps) {
  const t = useTranslations('planEditor')
  const locale = useLocale()
  const pdfLocale = locale === 'ru' || locale === 'en' || locale === 'sr' || locale === 'he' ? locale : 'he'
  const dir = pdfLocale === 'he' ? 'rtl' : 'ltr'
  const labelFont = pdfLocale === 'he'
    ? 'Arial Hebrew, "Noto Sans Hebrew", David, Arial, sans-serif'
    : 'sans-serif'
  const [sheet, setSheet] = useState<PlanDrawingSheetId>(initialSheet)
  const [chosenLengths, setChosenLengths] = useState<Map<string, number>>(new Map())
  const [pdfError, setPdfError] = useState<string | null>(null)
  const productionRef = useRef<HTMLDivElement>(null)
  const orderRef = useRef<HTMLDivElement>(null)

  const pieceSignature = pieces.map((piece) => `${piece.role}:${piece.profileId}:${Math.round(piece.lengthLongMm)}`).join('|')
  const approximate = useMemo(() => {
    if (isOrthogonal !== false) return false
    if (!planContour || planContour.length < 3) return true
    return !purlinEndsMeetFrame(pieces, planContour)
  }, [isOrthogonal, pieces, planContour])
  useEffect(() => {
    setChosenLengths(new Map())
  }, [pieceSignature])

  function chooseLength(bundleKey: string, stockLengthMm: number) {
    setChosenLengths((prev) => {
      const next = new Map(prev)
      next.set(bundleKey, stockLengthMm)
      return next
    })
  }

  const missingProfileId = pieces.find((piece) => piece.profileId && !PERGOLA_CONSTRUCTION_PROFILES.has(piece.profileId))?.profileId
    ?? (constructionParams?.purlinProfileId && !PERGOLA_CONSTRUCTION_PROFILES.has(constructionParams.purlinProfileId)
      ? constructionParams.purlinProfileId
      : undefined)
  const supportProfileId = constructionParams?.wingShelfProfileId
  const supportBlocked = supportProfileNeedsChoice(supportProfileId)
  const profileBlocked = missingProfileId != null || supportBlocked
  const longDivider = hasLongDividerWithoutSupport(
    pieces
      .filter((piece) => piece.role === 'purlin' && piece.dividerId !== WING_SHELF_SPAN_DIVIDER_ID)
      .map((piece) => piece.lengthAxisMm),
    constructionParams?.purlinMaxSpanMm,
  )
  const purlinChoices = CONSTRUCTION_PURLIN_IDS
    .filter((id) => !isRetiredProfileId(id))
    .map((id) => ({ id, label: formatConstructionProfileLabel(id) }))
  const supportChoices = supportProfileOptions.map((id) => ({
    id,
    label: formatConstructionProfileLabel(id),
  }))

  async function savePdf(kind: 'production' | 'order') {
    if (profileBlocked) return
    setPdfError(null)
    if (beforePrint) {
      const ok = await beforePrint()
      if (!ok) {
        setPdfError(t('drawing.pdfBlockedSave'))
        return
      }
    } else if (exportBlocked) {
      setPdfError(t('drawing.pdfBlockedSave'))
      return
    }
    const root = kind === 'production' ? productionRef.current : orderRef.current
    if (!root) return
    try {
      await downloadSheetPdf(root, kind === 'production' ? 'production.pdf' : 'order.pdf', pdfLocale)
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'PDF')
    }
  }

  const builtSections = useMemo(() => {
    if (!isLamellaSectionLayoutV1(constructionParams?.lamellaSectionLayoutVersion)) return null
    if (!planContour || planContour.length < 3 || !constructionParams) return null
    const spec = specFromPlan({ contour: planContour, wallEdgeIndices, params: constructionParams })
    return buildLamellaSections(spec, profiles)
  }, [constructionParams, planContour, profiles, wallEdgeIndices])
  const sections = builtSections != null && builtSections.length > 0 ? builtSections : undefined
  // A shape the section builder returns nothing for still gets the production pack;
  // only the sections page is left out of it.
  const sectionsNotCalculated = builtSections != null && builtSections.length === 0

  const planLandscape = useMemo(() => {
    if (!planContour || planContour.length < 3) return true
    const xs = planContour.map((p) => p[0])
    const ys = planContour.map((p) => p[1])
    return Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys)
  }, [planContour])

  const sectionLabels = {
    title: t('drawing.sheetSections'),
    type: t('drawing.sectionType'),
    quantity: t('drawing.sectionQty'),
    size: t('drawing.sectionSize'),
    lamellasPerSection: t('drawing.sectionLamellas'),
    lamellaLength: t('drawing.sectionLamellaLength'),
    totalSections: t('drawing.sectionTotal'),
    totalLamellas: t('drawing.sectionLamellaTotal'),
    categories: t('drawing.sectionCategories'),
    pieces: t('drawing.sectionPieces'),
    rowLengths: t('drawing.sectionRowLengths'),
    noSections: t('drawing.sectionsEmpty'),
  }
  const profileLabels = {
    frame: t('drawing.profileFrame'),
    purlin: t('drawing.profilePurlin'),
    lamella: t('drawing.profileLamella'),
    lit: t('drawing.purlinLit'),
    plain: t('drawing.purlinPlain'),
    wall: t('drawing.profileWall'),
    free: t('drawing.profileFree'),
    purlinLengths: t('drawing.purlinLengths'),
  }
  const sheetProfiles = useMemo(() => {
    const map = new Map(profiles)
    map.set(ANGLE_30_PROFILE_ID, angleProfileDimensions())
    return map
  }, [profiles])
  const sheetPlans = useMemo(() => {
    const color = pieces[0]?.color ?? '#9aa0a6'
    const angles = sections ? buildAngleCutPieces(sections, color) : []
    // Beam ids count the frame's counter-clockwise copy: translate the plan's wall indices.
    const wallBeamEdges = planContour && planContour.length >= 3
      ? wallEdgeIndicesInFrameOrder(planContour, wallEdgeIndices)
      : wallEdgeIndices
    return buildProfileBundlePlans([...piecesForCutting(pieces, wallBeamEdges), ...angles], sheetProfiles)
  }, [pieces, planContour, sections, sheetProfiles, wallEdgeIndices])
  const rtl = dir === 'rtl'
  const kerfNote = t('drawing.kerfNote', { mm: DEFAULT_KERF_MM })
  const cuttingHtml = useMemo(() => renderCuttingPages({
    plans: sheetPlans,
    profiles: sheetProfiles,
    rtl,
    chosenLengths,
    photoSrc: profilePhotoUrl,
    labels: {
      title: t('drawing.cuttingTab'),
      rest: t('drawing.cuttingRest'),
      wall: t('drawing.cutWall'),
      stock: t('drawing.stockLength'),
      bars: t('drawing.bars'),
      weight: t('drawing.colWeight'),
      weightMissing: t('drawing.weightNotSet'),
      weightIncomplete: (profile: string) => t('drawing.weightIncomplete', { profile }),
      noImage: t('drawing.cutNoImage'),
      noData: t('drawing.cutNoData'),
      sharedDrawing: t('drawing.cutSharedDrawing'),
      kerf: t('drawing.kerfNote', { mm: DEFAULT_KERF_MM }).split(/\d/)[0].trim(),
      schematic: t('drawing.cutSchematic'),
      howTitle: t('drawing.cutHowTitle'),
      howAngle: t('drawing.cutHowAngle'),
      howBeam: t('drawing.cutHowBeam'),
      howPart: t('drawing.cutHowPart'),
      howColor: t('drawing.cutHowColor'),
      lamellas: t('drawing.profileLamella'),
      beamMark: (n: number) => t('drawing.beamMark', { n }),
    },
  }).html, [sheetPlans, sheetProfiles, rtl, chosenLengths, t])
  const orderHtml = useMemo(() => renderOrderPages({
    plans: sheetPlans,
    profiles: sheetProfiles,
    rtl,
    chosenLengths,
    photoSrc: profilePhotoUrl,
    labels: {
      title: t('drawing.orderTab'),
      wall: t('drawing.cutWall'),
      stock: t('drawing.stockLength'),
      bars: t('drawing.bars'),
      meters: t('drawing.orderMeters'),
      profile: t('drawing.colProfile'),
      total: t('drawing.grandTotal'),
      weight: t('drawing.colWeight'),
      weightMissing: t('drawing.weightNotSet'),
      weightIncomplete: (profile: string) => t('drawing.weightIncomplete', { profile }),
      weightExcluding: (profiles: string) => t('drawing.weightExcluding', { profiles }),
      noImage: t('drawing.cutNoImage'),
      noData: t('drawing.cutNoData'),
      schematic: t('drawing.cutSchematic'),
      sharedDrawing: t('drawing.cutSharedDrawing'),
      kerfNote,
    },
  }).html, [sheetPlans, sheetProfiles, rtl, chosenLengths, kerfNote, t])
  const summaryHtml = useMemo(() => renderProductionSummary({
    plans: sheetPlans,
    rtl,
    chosenLengths,
    labels: {
      title: t('drawing.totalByProfile'),
      profile: t('drawing.colProfile'),
      bars: t('drawing.barsTotal'),
      meters: t('drawing.orderMeters'),
      weight: t('drawing.colWeight'),
      weightMissing: t('drawing.weightNotSet'),
      weightIncomplete: (profile: string) => t('drawing.weightIncomplete', { profile }),
      weightExcluding: (profiles: string) => t('drawing.weightExcluding', { profiles }),
      total: t('drawing.grandTotal'),
      kerfNote,
    },
  }), [sheetPlans, rtl, chosenLengths, kerfNote, t])

  if (!open) return null

  const tabClass = (id: PlanDrawingSheetId) =>
    sheet === id
      ? 'rounded bg-neutral-900 px-3 py-1 text-sm font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900'
      : 'rounded px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/60 p-4">
      <div className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-neutral-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={() => setSheet('plan')} className={tabClass('plan')}>
              {t('drawing.sheetPlan')}
            </button>
            <button type="button" onClick={() => setSheet('lamellaLayout')} className={tabClass('lamellaLayout')}>
              {t('drawing.sheetLamellaLayout')}
            </button>
            <button type="button" onClick={() => setSheet('sections')} className={tabClass('sections')}>
              {t('drawing.sheetSections')}
            </button>
            <button type="button" onClick={() => setSheet('cellFrame')} className={tabClass('cellFrame')}>
              {t('drawing.sheetCellFrame')}
            </button>
            <button type="button" onClick={() => setSheet('orderCutting')} className={tabClass('orderCutting')}>
              {t('drawing.sheetOrderCutting')}
            </button>
          </div>
          <button
            type="button"
            onClick={() => void savePdf('production')}
            disabled={profileBlocked || exportBlocked}
            className="rounded bg-neutral-900 px-3 py-1 text-sm font-semibold text-white print:hidden disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {t('drawing.productionPdf')}
          </button>
          <button
            type="button"
            onClick={() => void savePdf('order')}
            disabled={profileBlocked || exportBlocked}
            className="rounded border border-neutral-300 px-3 py-1 text-sm font-semibold text-neutral-800 print:hidden disabled:opacity-40 dark:border-neutral-600 dark:text-neutral-100"
          >
            {t('drawing.orderPdf')}
          </button>
          {pdfError && <span className="text-xs text-red-600">{pdfError}</span>}
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            {t('preview3D.closeButton')}
          </button>
        </div>
        {(missingProfileId || supportBlocked || exportBlocked || longDivider) && (
          <div className="flex flex-col gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2">
            {missingProfileId && (
              <ReplaceProfileNotice
                message={t('drawing.profileRetired', { profile: missingProfileId })}
                replaceLabel={t('drawing.replaceProfile')}
                title={t('drawing.replaceProfileTitle')}
                confirmLabel={t('drawing.replaceProfile')}
                options={purlinChoices}
                onChoose={(profileId) => onReplaceProfile?.('purlinProfileId', profileId)}
              />
            )}
            {supportBlocked && supportProfileId && (
              <ReplaceProfileNotice
                message={t('drawing.supportProfileBlocked', { profile: supportProfileId })}
                replaceLabel={t('drawing.replaceProfile')}
                title={t('drawing.replaceProfileTitle')}
                confirmLabel={t('drawing.replaceProfile')}
                options={supportChoices}
                onChoose={(profileId) => onReplaceProfile?.('wingShelfProfileId', profileId)}
              />
            )}
            {exportBlocked && (
              <p className="text-sm text-amber-950">{t('drawing.pdfBlockedSave')}</p>
            )}
            {longDivider && (
              <p className="text-sm text-amber-950">{t('drawing.longDividerNoSupport')}</p>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 bg-white dark:bg-neutral-900">
          {sheet === 'plan' && (
            <div className="flex h-full min-h-0">
              <div className="min-w-0 flex-1">
                <TopPlanSheet
                  pieces={pieces}
                  profiles={profiles}
                  planContour={planContour}
                  constructionParams={constructionParams}
                  lamellaDirectionDeg={lamellaDirectionDeg}
                  isOrthogonal={isOrthogonal}
                  nonOrthogonalWarningText={t('drawing.nonOrthogonalWarning')}
                  sections={sections}
                  purlinLengthLegendTitle={t('drawing.purlinLengths')}
                  wallEdgeIndices={wallEdgeIndices}
                  beamMark={(index) => t('drawing.beamMark', { n: index })}
                  labelFontFamily={labelFont}
                  showPurlinLengthLegend={false}
                  rowBoundaryLabel={t('drawing.rowBoundary')}
                  lamellaDirectionLabel={t('drawing.lamellaDirection')}
                />
              </div>
              {planContour && constructionParams && (
                <PlanProfileAside
                  contour={planContour}
                  pieces={pieces}
                  params={constructionParams}
                  profiles={profiles}
                  wallEdgeIndices={wallEdgeIndices}
                  labels={profileLabels}
                  dir={dir}
                  fontFamily={labelFont}
                />
              )}
            </div>
          )}
          {sheet === 'lamellaLayout' && (
            <LamellaLayoutSheet
              pieces={pieces}
              profiles={profiles}
              lamellaOnEdge={lamellaOnEdge}
              sections={sections}
            />
          )}
          {sheet === 'sections' && (
            <div className="flex h-full min-h-0 flex-col bg-white">
            <LamellaSectionsSheet sections={sections ?? []} labels={sectionLabels} dir={dir} fontFamily={labelFont} />
            </div>
          )}
          {sheet === 'cellFrame' && (
            <CellFrameSheet
              pieces={pieces}
              profiles={profiles}
              lamellaOnEdge={lamellaOnEdge}
              lengthReductionTotalMm={visturMode ? DEFAULT_VISTUR_TOLERANCES.lamellaLengthReductionMm : 0}
            />
          )}
          {sheet === 'orderCutting' && profileBlocked && (
            <p className="p-4 text-sm text-amber-900">
              {missingProfileId
                ? t('drawing.profileRetired', { profile: missingProfileId })
                : t('drawing.supportProfileBlocked', { profile: supportProfileId ?? '' })}
            </p>
          )}
          {sheet === 'orderCutting' && !profileBlocked && (
            <OrderAndCuttingPanel
              pieces={pieces}
              profiles={profiles}
              isOrthogonal={isOrthogonal}
              approximate={approximate}
              nonOrthogonalWarningText={t('drawing.nonOrthogonalWarning')}
              chosenLengths={chosenLengths}
              onChooseLength={chooseLength}
            />
          )}
        </div>
        {(sections || sectionsNotCalculated) && planContour && constructionParams && !profileBlocked && (
          <div className="plan-print-pack" aria-hidden="true">
            <style>{`
              .plan-print-pack {
                position: absolute;
                left: -16000px;
                top: 0;
                background: #fff;
                color: #111;
              }
            `}</style>
            <div ref={productionRef}>
              <section
                data-pdf-page
                data-pdf-orient={planLandscape ? 'land' : 'port'}
                style={{
                  width: planLandscape ? '281mm' : '190mm',
                  height: planLandscape ? '194mm' : '277mm',
                  display: 'flex',
                  background: '#fff',
                }}
              >
                <div className="plan-slot" style={{ flex: 1, minWidth: 0, height: '100%' }}>
                  <TopPlanSheet
                    pieces={pieces}
                    profiles={profiles}
                    planContour={planContour}
                    constructionParams={constructionParams}
                    lamellaDirectionDeg={lamellaDirectionDeg}
                    isOrthogonal={isOrthogonal}
                    sections={sections}
                    purlinLengthLegendTitle={t('drawing.purlinLengths')}
                    showPurlinLengthLegend={false}
                    wallEdgeIndices={wallEdgeIndices}
                    beamMark={(index) => t('drawing.beamMark', { n: index })}
                    labelFontFamily={labelFont}
                    rowBoundaryLabel={t('drawing.rowBoundary')}
                    lamellaDirectionLabel={t('drawing.lamellaDirection')}
                  />
                </div>
                <PlanProfileAside
                  contour={planContour}
                  pieces={pieces}
                  params={constructionParams}
                  profiles={profiles}
                  wallEdgeIndices={wallEdgeIndices}
                  labels={profileLabels}
                  dir={dir}
                  fontFamily={labelFont}
                />
              </section>
              <LamellaSectionsSheet sections={sections ?? []} labels={sectionLabels} dir={dir} fontFamily={labelFont} flowPages />
              <section data-pdf-page data-pdf-orient="land" className="land" style={{ width: '281mm', height: '194mm', background: '#fff' }}>
                <div className="layout-slot" style={{ width: '281mm', height: '194mm' }}>
                  <LamellaLayoutSheet pieces={pieces} profiles={profiles} lamellaOnEdge={lamellaOnEdge} sections={sections} />
                </div>
              </section>
              <div dangerouslySetInnerHTML={{ __html: cuttingHtml }} />
              <section
                data-pdf-page
                data-pdf-orient="port"
                data-pdf-kind="html"
                className="port"
                style={{ width: '190mm', background: '#fff' }}
                dangerouslySetInnerHTML={{ __html: summaryHtml }}
              />
            </div>
            <div ref={orderRef} dangerouslySetInnerHTML={{ __html: orderHtml }} />
          </div>
        )}
      </div>
    </div>
  )
}
