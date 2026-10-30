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

type PlanId = 'skew' | 'diagonal' | 'l10' | 'notch'
function planFromQuery(): PlanId {
  const raw = new URLSearchParams(location.search).get('plan')
  if (raw === 'diagonal' || raw === 'l10' || raw === 'notch') return raw
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
let params: typeof shared & {
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
const sections = buildLamellaSections(spec, profiles)

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
  pieces: built.pieces,
  profiles,
  planContour: contour,
  constructionParams: params,
  lamellaDirectionDeg: 0,
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
  },
}))
createRoot(document.getElementById('layout')!).render(createElement(LamellaLayoutSheet, {
  pieces: built.pieces,
  profiles,
  lamellaOnEdge: false,
  sections,
}))

const plans = buildProfileBundlePlans(built.pieces, profiles)
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
