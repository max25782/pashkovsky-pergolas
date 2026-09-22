import type { Offer, PergolaPlan } from '@/types/offer'
import type { PlanConstructionParams } from '@pashkovsky/pergola-core'

/**
 * Server-safe plan schematic. The drawing sheets are client components
 * (hooks), and Next turns that import into a client reference that
 * renderToStaticMarkup cannot render. The PDF only needs the confirmed
 * contour and its edge lengths.
 */
export function planContourSvg(
  polygon: Array<{ x: number; y: number }>,
  wallIndices: number[] = [],
): string {
  const xs = polygon.map((point) => point.x)
  const ys = polygon.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const pad = 900
  const width = Math.max(maxX - minX, 1) + pad * 2
  const height = Math.max(maxY - minY, 1) + pad * 2
  const screen = (point: { x: number; y: number }) => ({
    x: point.x - minX + pad,
    y: maxY - point.y + pad,
  })
  const points = polygon.map((point) => {
    const mapped = screen(point)
    return `${mapped.x.toFixed(1)},${mapped.y.toFixed(1)}`
  }).join(' ')
  const walls = new Set(wallIndices)
  const labels = polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    const lengthMm = Math.hypot(next.x - point.x, next.y - point.y)
    if (lengthMm < 1) return ''
    const mid = screen({ x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 })
    const text = `${Math.round(lengthMm)}`
    const fill = walls.has(index) ? '#1d4ed8' : '#111827'
    return `<text x="${mid.x.toFixed(1)}" y="${(mid.y - 28).toFixed(1)}" text-anchor="middle" font-size="220" font-family="Arial, sans-serif" fill="${fill}">${text}</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(1)} ${height.toFixed(1)}" width="520" height="360" data-plan-contour="1"><polygon points="${points}" fill="#f8fafc" stroke="#0f172a" stroke-width="40"/>${labels}</svg>`
}

async function drawingsFromContour(
  polygon: Array<{ x: number; y: number }>,
  wallIndices: number[],
): Promise<OfferDrawings> {
  return {
    topPlan: planContourSvg(polygon, wallIndices),
    lamellaLayout: null,
  }
}

/**
 * Генерирует SVG чертежа плана сверху (Top Plan) из данных полигона
 */
function legacyMetaPlan(offer: Offer): {
  polygon: Array<{ x: number; y: number }>
  wallIndices: number[]
  params: PlanConstructionParams
} | null {
  const meta = offer.configuratorMeta as {
    planPolygon?: Array<{ x: number; y: number }>
    planWallIndices?: number[]
    planParams?: PlanConstructionParams
  } | null
  if (!meta?.planPolygon || !Array.isArray(meta.planPolygon) || meta.planPolygon.length < 3) return null
  if (!meta.planParams) return null
  return {
    polygon: meta.planPolygon,
    wallIndices: meta.planWallIndices ?? [],
    params: meta.planParams,
  }
}

/** One pergola plan → top view + lamella sheet. Does not read configurator_meta. */
export async function generateDrawingsFromPlan(plan: PergolaPlan): Promise<OfferDrawings | null> {
  if (!plan.polygon || plan.polygon.length < 3) return null
  try {
    return await drawingsFromContour(plan.polygon, plan.wallIndices ?? [])
  } catch (error) {
    console.error('[generateDrawingsFromPlan]', error)
    return null
  }
}

export async function generateTopPlanSvg(offer: Offer): Promise<string | null> {
  const legacy = legacyMetaPlan(offer)
  if (!legacy) return null
  try {
    const drawings = await drawingsFromContour(legacy.polygon, legacy.wallIndices)
    return drawings.topPlan
  } catch (error) {
    console.error('[generateTopPlanSvg]', error)
    return null
  }
}

/**
 * Генерирует SVG чертежа раскладки ламелей
 */
export async function generateLamellaLayoutSvg(offer: Offer): Promise<string | null> {
  const legacy = legacyMetaPlan(offer)
  if (!legacy) return null
  try {
    const drawings = await drawingsFromContour(legacy.polygon, legacy.wallIndices)
    return drawings.lamellaLayout
  } catch (error) {
    console.error('[generateLamellaLayoutSvg]', error)
    return null
  }
}

/**
 * Основная функция для генерации всех чертежей предложения
 */
export interface OfferDrawings {
  topPlan: string | null
  lamellaLayout: string | null
}

export async function generateOfferDrawings(offer: Offer): Promise<OfferDrawings> {
  return {
    topPlan: await generateTopPlanSvg(offer),
    lamellaLayout: await generateLamellaLayoutSvg(offer),
  }
}
