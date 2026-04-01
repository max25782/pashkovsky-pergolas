import type { Offer } from '@/types/offer'

/**
 * Top-down rectangle plan for PDF (meters). Returns empty string if not a single rectangle.
 */
export function rectanglePlanSvgFragment(offer: Offer): string {
  const p = offer.pergolas?.[0] ?? offer.pergola
  if (!p?.shape || p.shape.type !== 'rectangle') return ''
  const widthM = p.shape.width
  const depthM = p.shape.length
  if (!(widthM > 0) || !(depthM > 0)) return ''

  const pad = 48
  const maxInner = 280
  const aspect = widthM / depthM
  let innerW = maxInner
  let innerH = maxInner
  if (aspect >= 1) innerH = maxInner / aspect
  else innerW = maxInner * aspect

  const svgW = innerW + pad * 2
  const svgH = innerH + pad * 2
  const x0 = pad
  const y0 = pad

  const wLabel = `${widthM} מ׳`
  const dLabel = `${depthM} מ׳`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" role="img" aria-label="תרשים מבט על">
  <rect x="0" y="0" width="${svgW}" height="${svgH}" fill="#ffffff"/>
  <line x1="${x0}" y1="${y0 - 28}" x2="${x0 + innerW}" y2="${y0 - 28}" stroke="#333" stroke-width="1"/>
  <line x1="${x0}" y1="${y0 - 32}" x2="${x0}" y2="${y0 - 24}" stroke="#333" stroke-width="1"/>
  <line x1="${x0 + innerW}" y1="${y0 - 32}" x2="${x0 + innerW}" y2="${y0 - 24}" stroke="#333" stroke-width="1"/>
  <text x="${x0 + innerW / 2}" y="${y0 - 36}" text-anchor="middle" font-size="11" fill="#111" font-family="Noto Sans Hebrew, Arial, sans-serif">${wLabel}</text>
  <line x1="${x0 - 28}" y1="${y0}" x2="${x0 - 28}" y2="${y0 + innerH}" stroke="#333" stroke-width="1"/>
  <line x1="${x0 - 32}" y1="${y0}" x2="${x0 - 24}" y2="${y0}" stroke="#333" stroke-width="1"/>
  <line x1="${x0 - 32}" y1="${y0 + innerH}" x2="${x0 - 24}" y2="${y0 + innerH}" stroke="#333" stroke-width="1"/>
  <text x="${x0 - 34}" y="${y0 + innerH / 2}" text-anchor="middle" font-size="11" fill="#111" font-family="Noto Sans Hebrew, Arial, sans-serif" transform="rotate(-90 ${x0 - 34} ${y0 + innerH / 2})">${dLabel}</text>
  <rect x="${x0}" y="${y0}" width="${innerW}" height="${innerH}" fill="none" stroke="#111" stroke-width="2"/>
  <text x="${x0 + innerW / 2}" y="${y0 + innerH / 2 + 4}" text-anchor="middle" font-size="10" fill="#555" font-family="Noto Sans Hebrew, Arial, sans-serif">מבט מלמעלה</text>
</svg>`
}
