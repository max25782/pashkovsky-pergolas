import fs from 'fs'
import path from 'path'
import type { Offer } from '@/types/offer'

interface ProfileEntry {
  id: string
  dimensions?: string
}

function loadProfilesMapLocal(): Map<string, ProfileEntry> {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'profiles.json')
    const raw = fs.readFileSync(filePath, 'utf-8')
    const json = JSON.parse(raw) as { profiles: ProfileEntry[] }
    return new Map(json.profiles.map((p) => [p.id, p]))
  } catch {
    return new Map()
  }
}

/** Parse "NxNmm" → thin dimension in cm (the smaller of the two). Returns 0 if unparseable. */
function profileThinCm(profileId: string | null | undefined): number {
  if (!profileId) return 0
  const map = loadProfilesMapLocal()
  const entry = map.get(profileId)
  if (!entry?.dimensions) return 0
  const match = entry.dimensions.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)mm$/i)
  if (!match) return 0
  const a = Number(match[1]) / 10
  const b = Number(match[2]) / 10
  return Math.min(a, b)
}

/**
 * Top-down rectangle plan for PDF (meters).
 * Draws the pergola outline, intermediate cross-beams (max 140 cm span),
 * and dimension annotations for all spans.
 * Span dimensions show clear inner distance (face-to-face), not center-to-center.
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

  // Resolve profile thin dimensions for clear-span calculation
  // Frame beam thin = the horizontal footprint of the side frame beams
  const frameThinCm = profileThinCm(cfgParams?.beamProfileId)
  // Divider thin = the width of each intermediate divider beam (as seen from above)
  const dividerThinCm = profileThinCm(cfgParams?.dividerProfileId ?? cfgParams?.beamProfileId)

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
  // Draw frame beam thickness on left and right sides (if known)
  if (frameThinCm > 0) {
    const fw = frameThinCm * scaleX
    lines.push(`<rect x="${x0}" y="${y0}" width="${fw}" height="${innerH}" fill="#c8d0e0" stroke="none"/>`)
    lines.push(`<rect x="${x0 + innerW - fw}" y="${y0}" width="${fw}" height="${innerH}" fill="#c8d0e0" stroke="none"/>`)
  }

  // ── Intermediate cross-beams + span dimension lines ──
  if (beamPosCm.length > 0) {
    // Build all span boundaries: 0, beam1, beam2, ..., widthCm
    const boundaries = [0, ...beamPosCm, widthCm]

    // Draw divider beams with actual width (if known) or as a line
    for (const bCm of beamPosCm) {
      const bx = x0 + bCm * scaleX
      if (dividerThinCm > 0) {
        const halfW = (dividerThinCm / 2) * scaleX
        lines.push(`<rect x="${bx - halfW}" y="${y0}" width="${halfW * 2}" height="${innerH}" fill="#c8d0e0" stroke="#555" stroke-width="1"/>`)
      } else {
        lines.push(`<line x1="${bx}" y1="${y0}" x2="${bx}" y2="${y0 + innerH}" stroke="#555" stroke-width="1.5" stroke-dasharray="6 3"/>`)
      }
    }

    // Bottom span dimension lines (one per span) — clear inner distance (face-to-face)
    //
    // boundaries[0]    = 0         → outer left edge of left frame beam
    // boundaries[last] = widthCm   → outer right edge of right frame beam
    // intermediate     = center line of each divider beam
    //
    // Clear span for each segment:
    //   left side:  if frame boundary → add frameThinCm to get inner face
    //               if divider center → add dividerThinCm/2 to get right face of divider
    //   right side: if frame boundary → subtract frameThinCm to get inner face
    //               if divider center → subtract dividerThinCm/2 to get left face of divider
    const spanDimY = y0 + innerH + 28
    for (let i = 0; i < boundaries.length - 1; i++) {
      const startCm = boundaries[i]
      const endCm = boundaries[i + 1]
      const isLeftFrame = i === 0
      const isRightFrame = i === boundaries.length - 2

      const leftDeduct  = isLeftFrame  ? frameThinCm        : dividerThinCm / 2
      const rightDeduct = isRightFrame ? frameThinCm        : dividerThinCm / 2
      const clearSpanCm = (endCm - startCm) - leftDeduct - rightDeduct

      // Pixel positions of the clear span faces
      const sx = x0 + (startCm + leftDeduct) * scaleX
      const ex = x0 + (endCm   - rightDeduct) * scaleX
      const mx = (sx + ex) / 2

      lines.push(`<line x1="${sx}" y1="${spanDimY - 4}" x2="${sx}" y2="${spanDimY + 4}" stroke="#555" stroke-width="1"/>`)
      lines.push(`<line x1="${ex}" y1="${spanDimY - 4}" x2="${ex}" y2="${spanDimY + 4}" stroke="#555" stroke-width="1"/>`)
      lines.push(`<line x1="${sx}" y1="${spanDimY}" x2="${ex}" y2="${spanDimY}" stroke="#555" stroke-width="1"/>`)
      lines.push(`<text x="${mx}" y="${spanDimY + 14}" text-anchor="middle" font-size="10" fill="#333" font-family="Noto Sans Hebrew, Arial, sans-serif">${fmtCm(clearSpanCm)}</text>`)
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
