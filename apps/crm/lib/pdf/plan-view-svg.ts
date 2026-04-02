import type { Offer } from '@/types/offer'

/**
 * Top-down rectangle plan for PDF (meters).
 * Draws the pergola outline, intermediate cross-beams (max 140 cm span),
 * and dimension annotations for all spans.
 * Returns empty string if not a single rectangle.
 */
export function rectanglePlanSvgFragment(offer: Offer): string {
  const p = offer.pergolas?.[0] ?? offer.pergola
  if (!p?.shape || p.shape.type !== 'rectangle') return ''
  const widthM = p.shape.width
  const depthM = p.shape.length
  if (!(widthM > 0) || !(depthM > 0)) return ''

  // Use configurator params if available for beam calc, else fall back to shape dims
  const cfgParams = offer.configuratorMeta?.params
  const widthCm = cfgParams?.widthCm ?? widthM * 100
  const depthCm = cfgParams?.depthCm ?? depthM * 100

  // --- Intermediate beam positions (same logic as PergolaMesh) ---
  const BEAM_MAX_SPAN_CM = 140
  function intermediateBeamPositionsCm(spanCm: number): number[] {
    if (spanCm <= BEAM_MAX_SPAN_CM) return []
    const segments = Math.ceil(spanCm / BEAM_MAX_SPAN_CM)
    const spacingCm = spanCm / segments
    const positions: number[] = []
    for (let i = 1; i < segments; i++) positions.push(spacingCm * i)
    return positions
  }
  const beamPosCm = intermediateBeamPositionsCm(widthCm)

  // --- Layout ---
  const padTop = 52   // room for top dimension line
  const padLeft = 52  // room for left (depth) dimension line
  const padRight = 16
  const padBottom = beamPosCm.length > 0 ? 52 : 20  // bottom span labels

  const maxInnerW = 300
  const maxInnerH = 220
  const aspect = widthM / depthM
  let innerW = maxInnerW
  let innerH = maxInnerH
  if (aspect >= 1) innerH = Math.min(maxInnerH, maxInnerW / aspect)
  else innerW = Math.min(maxInnerW, maxInnerH * aspect)

  const svgW = innerW + padLeft + padRight
  const svgH = innerH + padTop + padBottom
  const x0 = padLeft
  const y0 = padTop

  // Scale: pixels per cm
  const scaleX = innerW / widthCm
  const scaleY = innerH / depthCm

  // Helpers
  function fmt(cm: number): string {
    const m = cm / 100
    return Number.isInteger(m) ? `${m} מ׳` : `${m.toFixed(2).replace(/\.?0+$/, '')} מ׳`
  }
  function fmtCm(cm: number): string {
    return Number.isInteger(cm) ? `${cm} ס״מ` : `${cm.toFixed(1)} ס״מ`
  }

  const lines: string[] = []

  // Background
  lines.push(`<rect x="0" y="0" width="${svgW}" height="${svgH}" fill="#ffffff"/>`)

  // ── Top dimension line: total width ──
  const dimY = y0 - 32
  lines.push(`<line x1="${x0}" y1="${dimY}" x2="${x0 + innerW}" y2="${dimY}" stroke="#333" stroke-width="1"/>`)
  lines.push(`<line x1="${x0}" y1="${dimY - 4}" x2="${x0}" y2="${dimY + 4}" stroke="#333" stroke-width="1"/>`)
  lines.push(`<line x1="${x0 + innerW}" y1="${dimY - 4}" x2="${x0 + innerW}" y2="${dimY + 4}" stroke="#333" stroke-width="1"/>`)
  lines.push(`<text x="${x0 + innerW / 2}" y="${dimY - 7}" text-anchor="middle" font-size="11" fill="#111" font-family="Noto Sans Hebrew, Arial, sans-serif">${fmt(widthCm)}</text>`)

  // ── Left dimension line: total depth ──
  const dimX = x0 - 32
  lines.push(`<line x1="${dimX}" y1="${y0}" x2="${dimX}" y2="${y0 + innerH}" stroke="#333" stroke-width="1"/>`)
  lines.push(`<line x1="${dimX - 4}" y1="${y0}" x2="${dimX + 4}" y2="${y0}" stroke="#333" stroke-width="1"/>`)
  lines.push(`<line x1="${dimX - 4}" y1="${y0 + innerH}" x2="${dimX + 4}" y2="${y0 + innerH}" stroke="#333" stroke-width="1"/>`)
  lines.push(`<text x="${dimX - 6}" y="${y0 + innerH / 2}" text-anchor="middle" font-size="11" fill="#111" font-family="Noto Sans Hebrew, Arial, sans-serif" transform="rotate(-90 ${dimX - 6} ${y0 + innerH / 2})">${fmt(depthCm)}</text>`)

  // ── Pergola outline ──
  lines.push(`<rect x="${x0}" y="${y0}" width="${innerW}" height="${innerH}" fill="#f0f4ff" stroke="#111" stroke-width="2"/>`)

  // ── Intermediate cross-beams + span dimension lines ──
  if (beamPosCm.length > 0) {
    // Build all span boundaries: 0, beam1, beam2, ..., widthCm
    const boundaries = [0, ...beamPosCm, widthCm]

    // Draw beam lines
    for (const bCm of beamPosCm) {
      const bx = x0 + bCm * scaleX
      lines.push(`<line x1="${bx}" y1="${y0}" x2="${bx}" y2="${y0 + innerH}" stroke="#555" stroke-width="1.5" stroke-dasharray="6 3"/>`)
    }

    // Bottom span dimension lines (one per span)
    const spanDimY = y0 + innerH + 28
    for (let i = 0; i < boundaries.length - 1; i++) {
      const startCm = boundaries[i]
      const endCm = boundaries[i + 1]
      const spanCm = endCm - startCm
      const sx = x0 + startCm * scaleX
      const ex = x0 + endCm * scaleX
      const mx = (sx + ex) / 2

      lines.push(`<line x1="${sx}" y1="${spanDimY - 4}" x2="${sx}" y2="${spanDimY + 4}" stroke="#555" stroke-width="1"/>`)
      lines.push(`<line x1="${ex}" y1="${spanDimY - 4}" x2="${ex}" y2="${spanDimY + 4}" stroke="#555" stroke-width="1"/>`)
      lines.push(`<line x1="${sx}" y1="${spanDimY}" x2="${ex}" y2="${spanDimY}" stroke="#555" stroke-width="1"/>`)
      lines.push(`<text x="${mx}" y="${spanDimY + 14}" text-anchor="middle" font-size="10" fill="#333" font-family="Noto Sans Hebrew, Arial, sans-serif">${fmtCm(spanCm)}</text>`)
    }

    // Legend label
    lines.push(`<text x="${x0 + innerW / 2}" y="${y0 + innerH / 2 + 4}" text-anchor="middle" font-size="9" fill="#888" font-family="Noto Sans Hebrew, Arial, sans-serif">מבט מלמעלה</text>`)
  } else {
    lines.push(`<text x="${x0 + innerW / 2}" y="${y0 + innerH / 2 + 4}" text-anchor="middle" font-size="10" fill="#555" font-family="Noto Sans Hebrew, Arial, sans-serif">מבט מלמעלה</text>`)
  }

  // Depth dimension label inside (right side)
  lines.push(`<text x="${x0 + innerW - 6}" y="${y0 + innerH / 2}" text-anchor="end" font-size="9" fill="#777" font-family="Noto Sans Hebrew, Arial, sans-serif" transform="rotate(-90 ${x0 + innerW - 6} ${y0 + innerH / 2})">${fmt(depthCm)}</text>`)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" role="img" aria-label="תרשים מבט על">
  ${lines.join('\n  ')}
</svg>`
}
