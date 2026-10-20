import {
  DEFAULT_ANGLE_SPACING_CM,
  DEFAULT_FASTENER_RULES,
  DEFAULT_FRAME_CORNERS,
  DEFAULT_HANGER_COUNT,
  DEFAULT_SCREWS_PER_DIVISION_END,
  DEFAULT_SCREWS_PER_FRAME_CORNER,
  DEFAULT_SCREWS_PER_HANGER,
  DEFAULT_SHADE_BEARING_FRAMES,
  DEFAULT_SPARE_PCT,
} from './defaults'
import type { BomModel, BomPart, FastenerLine, FastenerRule } from './types'

function applySpare(quantity: number, sparePct: number): number {
  return Math.ceil(quantity * (1 + sparePct / 100))
}

function shadeLine(model: BomModel, parts: BomPart[], rule: FastenerRule): FastenerLine {
  const shadeCount = parts.filter((p) => p.kind === 'shade').length
  const divisionCount = parts.filter((p) => p.kind === 'division').length
  const frames = rule.shadeBearingFrameCount ?? DEFAULT_SHADE_BEARING_FRAMES
  const quantity = shadeCount * (divisionCount + frames)
  const sparePct = rule.sparePct ?? DEFAULT_SPARE_PCT
  const formula = `${shadeCount} профиля затенения × (${divisionCount} делительных + ${frames} рамные) = ${quantity}`
  return finish(rule, formula, quantity, sparePct)
}

function constructionLine(model: BomModel, parts: BomPart[], rule: FastenerRule): FastenerLine {
  const divisionCount = parts.filter((p) => p.kind === 'division').length
  const hasFrame = parts.some((p) => p.kind === 'frame')
  const perEnd = rule.screwsPerDivisionEnd ?? DEFAULT_SCREWS_PER_DIVISION_END
  const perCorner = rule.screwsPerFrameCorner ?? DEFAULT_SCREWS_PER_FRAME_CORNER
  const perHanger = rule.screwsPerHanger ?? DEFAULT_SCREWS_PER_HANGER
  const corners = hasFrame ? DEFAULT_FRAME_CORNERS : 0
  const hangers = rule.hangerCount ?? model.posts?.count ?? (hasFrame ? DEFAULT_HANGER_COUNT : 0)
  const divisionQty = divisionCount * 2 * perEnd
  const cornerQty = corners * perCorner
  const hangerQty = hangers * perHanger
  const quantity = divisionQty + cornerQty + hangerQty
  const sparePct = rule.sparePct ?? DEFAULT_SPARE_PCT
  const formula =
    `${divisionCount} делительных × 2 конца × ${perEnd} + ` +
    `${corners} угловых соединения рамы × ${perCorner} + ` +
    `${hangers} подвесных × ${perHanger} = ${quantity}`
  return finish(rule, formula, quantity, sparePct)
}

function angleScrewsForLength(lengthCm: number, spacingCm: number, includeEnds: boolean): number {
  if (lengthCm <= 0 || spacingCm <= 0) return 0
  const along = Math.floor(lengthCm / spacingCm)
  return includeEnds ? along + 1 : Math.max(1, along)
}

function angleLine(parts: BomPart[], rule: FastenerRule): FastenerLine {
  const angles = parts.filter((p) => p.kind === 'angle')
  const spacing = rule.spacingCm ?? DEFAULT_ANGLE_SPACING_CM
  const includeEnds = rule.includeEnds !== false
  const perLength = new Map<number, { count: number; screws: number }>()
  let quantity = 0
  for (const part of angles) {
    const screws = angleScrewsForLength(part.lengthCm, spacing, includeEnds)
    quantity += screws
    const prev = perLength.get(part.lengthCm)
    if (prev) prev.count += 1
    else perLength.set(part.lengthCm, { count: 1, screws })
  }
  const bits = [...perLength.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([len, { count, screws }]) => `(${len}/${spacing}+${includeEnds ? 1 : 0})×${count} = ${screws * count}`)
  const formula = bits.length > 0 ? `уголки: ${bits.join(' + ')} = ${quantity}` : `уголки: 0`
  const sparePct = rule.sparePct ?? DEFAULT_SPARE_PCT
  return finish(rule, formula, quantity, sparePct)
}

function finish(rule: FastenerRule, formula: string, quantity: number, sparePct: number): FastenerLine {
  const total = applySpare(quantity, sparePct)
  const pricePerUnit = rule.pricePerUnit
  return {
    id: rule.id,
    name: rule.name,
    formula,
    quantity,
    sparePct,
    total,
    unit: rule.unit,
    pricePerUnit,
    costIls: pricePerUnit != null ? total * pricePerUnit : undefined,
  }
}

export function fasteners(
  model: BomModel,
  parts: BomPart[],
  rules: FastenerRule[] = DEFAULT_FASTENER_RULES,
): FastenerLine[] {
  return rules.map((rule) => {
    if (rule.kind === 'shade_screws') return shadeLine(model, parts, rule)
    if (rule.kind === 'construction_screws') return constructionLine(model, parts, rule)
    return angleLine(parts, rule)
  })
}
