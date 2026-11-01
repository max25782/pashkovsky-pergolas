import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import {
  PERGOLA_CONSTRUCTION_PROFILES,
  axisLengthsFromOuterLengthsMm,
  beamPlanWidthForDrawing,
  buildLamellaSections,
  buildPieces,
  contourSideWidthMm,
  resolveLamellaPatternIds,
  sideBeamProfileId,
  specFromPlan,
} from '@pashkovsky/pergola-core'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../../../../packages/pergola-core/src/planDefaults.ts'
import { LamellaLayoutSheet } from '../../../../packages/pergola-drawing/src/LamellaLayoutSheet.tsx'
import { LamellaSectionsSheet } from '../../../../packages/pergola-drawing/src/LamellaSectionsSheet.tsx'
import { TopPlanSheet } from '../../../../packages/pergola-drawing/src/TopPlanSheet.tsx'
import {
  applyStraightBeam,
  pentagonV2Contour,
  pentagonV2PlanParams,
} from '../../../../packages/plan-editor/src/model/__tests__/fixtures/skew-pentagon-850-2026-11-01-v2.ts'
import {
  SKEW_PENTAGON_850_CENTERLINE_MM,
  SKEW_PENTAGON_850_OUTER_CM,
  SKEW_PENTAGON_850_TYPED_OUTER_MM,
} from '../../../../packages/plan-editor/src/model/__tests__/fixtures/skew-pentagon-850-2026-11-01.ts'
import { buildProfileBundlePlans } from '../../lib/cut-list/order-sheet.ts'
import { renderCuttingPages, renderProductionSummary } from '../../lib/cut-list/cut-map.ts'
import he from '../../messages/he.json'
import en from '../../messages/en.json'
import ru from '../../messages/ru.json'
import sr from '../../messages/sr.json'

type Locale = 'he' | 'en' | 'ru' | 'sr'
const packs: Record<Locale, { planEditor: { drawing: Record<string, string> } }> = { he, en, ru, sr }

function localeFromQuery(): Locale {
  const raw = new URLSearchParams(location.search).get('locale')
  if (raw === 'en' || raw === 'ru' || raw === 'sr' || raw === 'he') return raw
  return 'he'
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''))
}

const locale = localeFromQuery()
const text = packs[locale].planEditor.drawing
const rtl = locale === 'he'
const font = rtl ? 'Arial Hebrew, "Noto Sans Hebrew", David, Arial, sans-serif' : 'sans-serif'
document.documentElement.lang = locale
document.documentElement.dir = rtl ? 'rtl' : 'ltr'

function walk(lengths: number[], angles: number[]): Array<[number, number]> {
  let x = 0
  let y = 0
  const vertices: Array<[number, number]> = [[0, 0]]
  for (let i = 0; i < lengths.length; i++) {
    const rad = (angles[i] * Math.PI) / 180
    x += lengths[i] * Math.cos(rad)
    y += lengths[i] * Math.sin(rad)
    if (i < lengths.length - 1) vertices.push([x, y])
  }
  return vertices
}

type PlanId = 'skew' | 'diagonal' | 'l10' | 'notch' | 'pentagon' | 'pentagon-exact' | 'pentagon-v2' | 'pentagon-v2-ccw'
function planFromQuery(): PlanId {
  const raw = new URLSearchParams(location.search).get('plan')
  if (
    raw === 'diagonal' || raw === 'l10' || raw === 'notch' || raw === 'pentagon' || raw === 'pentagon-exact' ||
    raw === 'pentagon-v2' || raw === 'pentagon-v2-ccw'
  ) return raw
  return 'skew'
}

const planId = planFromQuery()
const shared = {
  ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  lamellaGapMm: 20,
  wingShelfProfileId: 'purlin-plain-5030',
  wallBeamWidthVersion: 1 as const,
  lamellaDirectionDeg: 0,
  purlinMaxSpanMm: 4000,
  purlinClearLayoutVersion: 1 as const,
  lamellaSectionLayoutVersion: 1 as const,
  frameJointVersion: 1 as const,
  purlinProfileId: 'PA3022',
}

let contour: Array<[number, number]>
let wallEdgeIndices: number[]
let params: Omit<typeof shared, 'purlinMaxSpanMm'> & {
  purlinMaxSpanMm?: number
  beamProfileId: string
  wallProfileId: string
  measuredOuterLengthMmByEdgeIndex?: number[]
}

if (planId === 'diagonal') {
  const lengths = [1637.1, 3813.6, 4995.1, 2898.9, 8658.5, 6129.7]
  const alpha = Math.acos(2026.3 / 3813.6) * (180 / Math.PI)
  const angles = [0, alpha, 0, 90, 180, 270]
  const axis = axisLengthsFromOuterLengthsMm({ outerLengthsMm: lengths, angleDeg: angles, defaultBeamPlanWidthMm: 40 })
  contour = walk(axis, angles)
  wallEdgeIndices = []
  params = {
    ...shared,
    beamProfileId: 'f10040',
    wallProfileId: 'f10040',
    measuredOuterLengthMmByEdgeIndex: lengths,
  }
} else if (planId === 'pentagon-v2' || planId === 'pentagon-v2-ccw') {
  // Skew pentagon v2: contour of v1 plus 7 explicit crossbeams (PA3022) and the straight beam.
  // `pentagon-v2` is the plan as the editor shows it now (mirrored, clockwise); `pentagon-v2-ccw`
  // is the same plan in the drawing frame (counter-clockwise), used to expose the clockwise bug.
  wallEdgeIndices = []
  contour = pentagonV2Contour(planId === 'pentagon-v2')
  params = pentagonV2PlanParams(DEFAULT_PLAN_CONSTRUCTION_PARAMS)
} else if (planId === 'pentagon' || planId === 'pentagon-exact') {
  // Skew pentagon of 2026-11-01. `pentagon` builds the centerline the way the live skew plans
  // do (typed outers + headings -> axisLengthsFromOuterLengthsMm). `pentagon-exact` takes the
  // frozen centerline whose outer face is the drawing contour.
  wallEdgeIndices = []
  params = {
    ...shared,
    beamProfileId: 'f10040',
    wallProfileId: 'f10040',
    // Lamellas run along the long side EA; the drawing's rows are the crossbeams that cut them.
    lamellaDirectionDeg: 90,
    measuredOuterLengthMmByEdgeIndex: [...SKEW_PENTAGON_850_TYPED_OUTER_MM],
  }
  // Drawing rows: clear gaps 121.2 cm x6 then 108.7 cm x2, crossbeam and frame beam 40 mm.
  // Centres along the long side, measured from the outer face of AB (outer y = 0).
  const crossbeamCentresOuterY = [1272, 2524, 3776, 5028, 6280, 7532, 8659]
  // The exact contour keeps the outer origin; the typed contour starts on the AB centerline (-20 mm).
  const originShiftMm = planId === 'pentagon-exact' ? 0 : -20
  params = {
    ...params,
    purlinDividers: {
      mode: 'manual',
      lines: crossbeamCentresOuterY.map((y, i) => ({ id: `row-${i + 1}`, positionMm: y + originShiftMm })),
    },
  }
  if (planId === 'pentagon-exact') {
    contour = SKEW_PENTAGON_850_CENTERLINE_MM.map((p): [number, number] => [p.x, p.y])
  } else {
    const outer = SKEW_PENTAGON_850_OUTER_CM
    const angles = outer.map(([x, y], i) => {
      const [nx, ny] = outer[(i + 1) % outer.length]
      return (Math.atan2(ny - y, nx - x) * 180) / Math.PI
    })
    const axis = axisLengthsFromOuterLengthsMm({
      outerLengthsMm: [...SKEW_PENTAGON_850_TYPED_OUTER_MM],
      angleDeg: angles,
      defaultBeamPlanWidthMm: 40,
    })
    contour = walk(axis, angles)
  }
} else if (planId === 'l10') {
  const lengths = [5000, 4000, 10000, 8000, 5000, 4000]
  const angles = [0, 90, 180, 270, 0, 90]
  wallEdgeIndices = [0, 4, 5]
  const beamProfileId = 'pa1429'
  const wallProfileId = 'f10040'
  const axis = axisLengthsFromOuterLengthsMm({
    outerLengthsMm: lengths,
    angleDeg: angles,
    defaultBeamPlanWidthMm: 70,
    planWidthForEdge: (edgeIndex) => contourSideWidthMm(PERGOLA_CONSTRUCTION_PROFILES, edgeIndex, {
      wallEdgeIndices,
      beamProfileId,
      wallProfileId,
      wallBeamWidthVersion: 1,
    }),
  })
  contour = walk(axis, angles)
  params = {
    ...shared,
    beamProfileId,
    wallProfileId,
    measuredOuterLengthMmByEdgeIndex: lengths,
  }
} else if (planId === 'notch') {
  contour = [
    [0, 0],
    [4569.400649472891, 0],
    [3900.9553840361427, 3091.320359563252],
    [-5161.95641942771, 3091.320359563253],
    [-5161.956419427711, -4277.608480798192],
    [-2324.9246987951806, -4277.608480798192],
  ]
  wallEdgeIndices = []
  params = {
    ...shared,
    wingShelfProfileId: 'PA1296',
    beamProfileId: 'f10040',
    wallProfileId: 'f10040',
  }
} else {
  contour = [
    [0, 0],
    [6421.82181354009, 0],
    [6421.82181354009, 3726.450217473525],
    [-5163.666556354009, 3726.450217473526],
    [-5163.666556354011, -4924.179746596066],
    [212.0071388048409, -4924.179746596066],
  ]
  wallEdgeIndices = []
  params = { ...shared, beamProfileId: 'f10040', wallProfileId: 'f10040' }
}

const profiles = PERGOLA_CONSTRUCTION_PROFILES
const spec = specFromPlan({ contour, wallEdgeIndices, params })
const built = buildPieces(spec, profiles)
let pieces = built.pieces
if (planId === 'pentagon-v2' || planId === 'pentagon-v2-ccw') {
  // The editor cannot store a beam parallel to the lamellas: assemble it after buildPieces.
  const withBeam = applyStraightBeam({ pieces, profiles, contour, mirror: planId === 'pentagon-v2' })
  pieces = withBeam.pieces
  document.body.dataset.beam = JSON.stringify({ attachment: withBeam.attachment, parts: withBeam.parts })
}
const sections = buildLamellaSections(spec, profiles)
// Numbers of the frame and crossbeams for checking against the drawing (dev harness only).
document.body.dataset.cutSummary = JSON.stringify({
  frame: pieces
    .filter((piece) => piece.role === 'beam')
    .map((piece) => [Math.round(piece.lengthAxisMm * 10) / 10, Math.round(piece.lengthLongMm * 10) / 10, Math.round(piece.lengthShortMm * 10) / 10]),
  purlins: pieces
    .filter((piece) => piece.role === 'purlin')
    .map((piece) => [Math.round(piece.lengthAxisMm * 10) / 10, Math.round(piece.lengthLongMm * 10) / 10, Math.round(piece.lengthShortMm * 10) / 10]),
})

function profileSize(profileId: string): string {
  const profile = profiles.get(profileId)
  const plan = beamPlanWidthForDrawing(profiles, profileId).planWidthMm
  const height = profile?.heightMm && profile.heightMm > 0 ? profile.heightMm : plan
  return `${Math.round(height)}×${Math.round(plan)}`
}

const walls = new Set(wallEdgeIndices)
const seen = new Set<string>()
const frameRows: string[] = []
for (let i = 0; i < contour.length; i++) {
  const isWall = walls.has(i)
  const profileId = sideBeamProfileId({
    isWall,
    beamProfileId: params.beamProfileId,
    wallProfileId: params.wallProfileId,
    wallBeamWidthVersion: params.wallBeamWidthVersion,
  })
  const key = `${isWall ? 'wall' : 'free'}:${profileId}`
  if (seen.has(key)) continue
  seen.add(key)
  const title = isWall ? `${text.profileFrame}, ${text.profileWall}` : text.profileFree
  frameRows.push(`${title}: <span class="ltr">${profileSize(profileId)}</span>`)
}
const purlin = profiles.get(params.purlinProfileId)
const lamellaMm = [
  ...new Set(
    resolveLamellaPatternIds(params.lamellaPatternId, params.lamellaWallThicknessMm)
      .map((id) => profiles.get(id)?.widthMm)
      .filter((mm): mm is number => mm != null && mm > 0),
  ),
]
const aside = document.getElementById('aside')
if (aside) {
  aside.dir = rtl ? 'rtl' : 'ltr'
  aside.dataset.wallEdges = wallEdgeIndices.join(',')
  aside.innerHTML = `
    <p class="label">${text.profileFrame}</p>
    <ul>${frameRows.map((row) => `<li>${row}</li>`).join('')}</ul>
    <p class="label">${text.profilePurlin}</p>
    <p>${purlin?.hasLedChannel === true ? text.purlinLit : text.purlinPlain}</p>
    <p class="label">${text.profileLamella}</p>
    <p class="ltr">${lamellaMm.map((mm) => Math.round(mm)).join(' / ')}</p>
  `
}

createRoot(document.getElementById('plan')!).render(createElement(TopPlanSheet, {
  pieces,
  profiles,
  planContour: contour,
  constructionParams: params,
  lamellaDirectionDeg: params.lamellaDirectionDeg,
  isOrthogonal: built.isOrthogonal,
  nonOrthogonalWarningText: text.nonOrthogonalWarning,
  sections,
  purlinLengthLegendTitle: text.purlinLengths,
  wallEdgeIndices,
  beamMark: (index: number) => fill(text.beamMark, { n: index }),
  labelFontFamily: font,
  showPurlinLengthLegend: false,
  rowBoundaryLabel: text.rowBoundary,
  lamellaDirectionLabel: text.lamellaDirection,
}))
createRoot(document.getElementById('sections')!).render(createElement(LamellaSectionsSheet, {
  sections,
  dir: rtl ? 'rtl' : 'ltr',
  fontFamily: font,
  flowPages: true,
  labels: {
    title: text.sheetSections,
    type: text.sectionType,
    quantity: text.sectionQty,
    size: text.sectionSize,
    lamellasPerSection: text.sectionLamellas,
    lamellaLength: text.sectionLamellaLength,
    totalSections: text.sectionTotal,
    totalLamellas: text.sectionLamellaTotal,
    categories: text.sectionCategories,
    pieces: text.sectionPieces,
    rowLengths: text.sectionRowLengths,
    noSections: text.sectionsEmpty,
  },
}))
createRoot(document.getElementById('layout')!).render(createElement(LamellaLayoutSheet, {
  pieces,
  profiles,
  lamellaOnEdge: false,
  sections,
}))

const plans = buildProfileBundlePlans(pieces, profiles)
const cutting = document.getElementById('cutting')
if (cutting) {
  const drawn = renderCuttingPages({
    plans,
    profiles,
    rtl,
    labels: {
      title: text.cuttingTab,
      rest: text.cuttingRest,
      wall: text.cutWall,
      stock: text.stockLength,
      bars: text.bars,
      weight: text.colWeight,
      weightMissing: text.weightNotSet,
      noImage: text.cutNoImage,
      noData: text.cutNoData,
      sharedDrawing: text.cutSharedDrawing,
      kerf: text.kerfNote.split('{mm}')[0].trim(),
      schematic: text.cutSchematic,
      howTitle: text.cutHowTitle,
      howAngle: text.cutHowAngle,
      howBeam: text.cutHowBeam,
      howPart: text.cutHowPart,
      howColor: text.cutHowColor,
      lamellas: text.profileLamella,
      beamMark: (n: number) => fill(text.beamMark, { n }),
    },
    photoSrc: (file) => `/${file}`,
  })
  cutting.innerHTML = drawn.html
  cutting.dataset.photos = JSON.stringify(drawn.photos)
}

const order = document.getElementById('order')
if (order) {
  order.dir = rtl ? 'rtl' : 'ltr'
  order.innerHTML = renderProductionSummary({
    plans,
    rtl,
    labels: {
      title: text.totalByProfile,
      profile: text.colProfile,
      bars: text.barsTotal,
      meters: text.orderMeters,
      weight: text.colWeight,
      weightMissing: text.weightNotSet,
      total: text.grandTotal,
      kerfNote: fill(text.kerfNote, { mm: 5 }),
    },
  })
}

const images = [...document.images]
const markReady = () => {
  document.body.dataset.ready = '1'
}
if (images.length === 0) {
  requestAnimationFrame(() => requestAnimationFrame(markReady))
} else {
  const loaded = images.map((img) => (img.complete
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        img.onload = () => resolve()
        img.onerror = () => resolve()
      })))
  void Promise.race([
    Promise.all(loaded),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]).then(() => requestAnimationFrame(markReady))
}
