import type { CutListResult, ProfileGroup, StockBar, SantafOrderLine } from './calculate-cut-list'
import { KERF_CM } from './calculate-cut-list'
import { getHebrewFontsCss } from '@/lib/pdf/font-loader'
import { pdfT, resolvePdfLocale, pdfHtmlDir, pdfBcp47Locale, type PdfDict } from '@/lib/pdf/offer-pdf-i18n'

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function fillTpl(s: string, vars: Record<string, string | number>): string {
  let out = s
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, String(v))
  }
  return out
}

function fmtCm(cm: number, t: PdfDict): string {
  const m = cm / 100
  const mStr = Number.isInteger(m) ? `${m}` : m.toFixed(2).replace(/\.?0+$/, '')
  return `${cm} ${t.cut_cm} (${mStr} ${t.cut_m})`
}

function fmtCmShort(cm: number, t: PdfDict): string {
  return `${Math.round(cm * 10) / 10} ${t.cut_cm}`
}

function barSvg(bar: StockBar, t: PdfDict): string {
  const W = 420
  const H = 28
  const scale = W / bar.stockLengthCm
  const kerfW = Math.max(1.5, KERF_CM * scale)

  const palette = ['#4a90d9', '#e67e22', '#27ae60', '#8e44ad', '#c0392b', '#16a085', '#d35400']
  const labelColors: Record<string, string> = {}
  let colorIdx = 0

  const rects: string[] = []
  let x = 0
  for (const cut of bar.cuts) {
    if (!(cut.label in labelColors)) {
      labelColors[cut.label] = palette[colorIdx % palette.length]
      colorIdx++
    }
    const w = cut.lengthCm * scale
    rects.push(
      `<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${H}" fill="${labelColors[cut.label]}" stroke="none"/>`,
    )
    if (w > 24) {
      rects.push(
        `<text x="${(x + w / 2).toFixed(1)}" y="${H / 2 + 4}" text-anchor="middle" font-size="8" fill="#fff" font-family="Arial,sans-serif">${Math.round(cut.lengthCm)}</text>`,
      )
    }
    x += w
    rects.push(
      `<rect x="${x.toFixed(1)}" y="0" width="${kerfW.toFixed(1)}" height="${H}" fill="#555" stroke="none" title="${escapeHtml(t.cut_kerf)} ${KERF_CM} ${t.cut_cm}"/>`,
    )
    x += KERF_CM * scale
  }

  const remaining = W - x
  if (remaining > 0.5) {
    rects.push(
      `<rect x="${x.toFixed(1)}" y="0" width="${remaining.toFixed(1)}" height="${H}" fill="#ddd" stroke="none"/>`,
    )
    if (remaining > 20) {
      rects.push(
        `<text x="${(x + remaining / 2).toFixed(1)}" y="${H / 2 + 4}" text-anchor="middle" font-size="8" fill="#999" font-family="Arial,sans-serif">${escapeHtml(t.cut_waste)}</text>`,
      )
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${rects.join('')}</svg>`
}

function profileGroupHtml(
  g: ProfileGroup,
  idx: number,
  t: PdfDict,
  lamellaGapCm?: number,
  lamellaQty?: number,
): string {
  const piecesRows = g.pieces
    .map(
      (p) => `
      <tr>
        <td>${escapeHtml(p.label)}</td>
        <td class="num">${fmtCmShort(p.lengthCm, t)}</td>
        <td class="num">${p.qty}</td>
        <td class="num">${fmtCmShort(p.lengthCm * p.qty, t)}</td>
      </tr>`,
    )
    .join('')

  const barsRows = g.bars
    .map(
      (bar, bi) => `
      <tr>
        <td class="bar-no">${bi + 1}</td>
        <td class="bar-svg">${barSvg(bar, t)}</td>
        <td class="num">${fmtCmShort(bar.usedCm, t)}</td>
        <td class="num waste">${fmtCmShort(bar.wasteCm, t)}</td>
      </tr>`,
    )
    .join('')

  const lamellaNote =
    lamellaGapCm !== undefined && lamellaQty !== undefined
      ? `<div class="lamella-note">${t.cut_lamella_gap}: <strong>${fmtCmShort(lamellaGapCm, t)}</strong> &nbsp;|&nbsp; ${t.cut_lamella_qty}: <strong>${lamellaQty}</strong></div>`
      : ''

  return `
  <div class="group" id="group-${idx}">
    <div class="group-header">
      <span class="group-title">${escapeHtml(g.profileName)}</span>
      <span class="group-stock">${t.cut_stock_bar}: ${fmtCm(g.stockLengthCm, t)}</span>
    </div>
    ${lamellaNote}

    <h4 class="sub-title">${t.cut_pieces_title}</h4>
    <table class="pieces-table">
      <thead>
        <tr>
          <th>${t.cut_th_part}</th>
          <th class="num">${t.cut_th_piece_len}</th>
          <th class="num">${t.cut_th_qty}</th>
          <th class="num">${t.cut_th_total_len}</th>
        </tr>
      </thead>
      <tbody>${piecesRows}</tbody>
    </table>

    <h4 class="sub-title">${t.cut_plan_title} (${g.totalBars} ${t.cut_plan_bars_unit})</h4>
    <table class="bars-table">
      <thead>
        <tr>
          <th>#</th>
          <th>${t.cut_th_diag}</th>
          <th class="num">${t.cut_th_use}</th>
          <th class="num">${t.cut_th_waste}</th>
        </tr>
      </thead>
      <tbody>${barsRows}</tbody>
    </table>

    <div class="summary-row">
      <span>${t.cut_total_bars}: <strong>${g.totalBars}</strong></span>
      <span>${fillTpl(t.cut_waste_note, { kerf: String(KERF_CM) })}: <strong>${fmtCmShort(g.totalWasteCm, t)}</strong> (${g.wastePercent.toFixed(1)}%)</span>
    </div>
  </div>`
}

function orderSummaryHtml(result: CutListResult, t: PdfDict): string {
  const profileRows = result.groups
    .map(
      (g) => `
      <tr>
        <td>${escapeHtml(g.profileName)}</td>
        <td class="num">${fmtCm(g.stockLengthCm, t)}</td>
        <td class="num order-qty">${g.totalBars}</td>
      </tr>`,
    )
    .join('')

  const santafRows = result.santafLines
    .map(
      (s: SantafOrderLine) => `
      <tr>
        <td>${escapeHtml(t.cut_santaf_row)}</td>
        <td class="num">${fmtCm(s.lengthCm, t)}</td>
        <td class="num order-qty">${s.qty}</td>
      </tr>`,
    )
    .join('')

  if (!profileRows && !santafRows) return ''

  return `
  <div class="order-summary">
    <div class="order-summary-header">${t.cut_order_summary}</div>
    <table class="order-table">
      <thead>
        <tr>
          <th>${t.cut_th_item}</th>
          <th class="num">${t.cut_th_len_per_bar}</th>
          <th class="num">${t.cut_th_order_qty}</th>
        </tr>
      </thead>
      <tbody>
        ${profileRows}
        ${santafRows}
      </tbody>
    </table>
  </div>`
}

export function renderCutListHtml(result: CutListResult, locale?: string): string {
  const loc = resolvePdfLocale(locale)
  const t = pdfT[loc]
  const dir = pdfHtmlDir(loc)
  const lang = pdfBcp47Locale(loc)
  const fontsCss = getHebrewFontsCss()
  const date = new Date(result.generatedAt).toLocaleDateString(lang, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const groupsHtml = result.groups
    .map((g, i) => {
      const isLamella = g.category === 'lamella'
      return profileGroupHtml(
        g,
        i,
        t,
        isLamella ? result.lamellaGapCm : undefined,
        isLamella ? result.lamellaQty : undefined,
      )
    })
    .join('\n')
  const summaryHtml = orderSummaryHtml(result, t)

  const estimatedWarning = result.estimated
    ? `<div class="warning">⚠️ ${escapeHtml(t.cut_warn_estimated)}</div>`
    : ''

  const heightWord =
    loc === 'he' ? 'גובה' : loc === 'ru' ? 'Высота' : loc === 'sr' ? 'Visina' : 'Height'
  const dimsRow = `${result.widthCm} × ${result.depthCm} ${t.cut_cm}, ${heightWord} ${result.heightCm} ${t.cut_cm}`

  const title = fillTpl(t.cut_title, { name: escapeHtml(result.customerName) })

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${lang.split('-')[0]}">
<head>
<meta charset="UTF-8"/>
<style>
${fontsCss}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-size: 12px;
  color: #111;
  background: #fff;
  padding: 0;
  direction: ${dir};
}

.page-header {
  border-bottom: 3px solid #1a3a5c;
  padding-bottom: 10px;
  margin-bottom: 18px;
}
.page-header h1 { font-size: 20px; color: #1a3a5c; }
.page-header .meta { font-size: 11px; color: #555; margin-top: 4px; }

.warning {
  background: #fff8e1;
  border: 1px solid #f9a825;
  border-radius: 4px;
  padding: 8px 12px;
  margin-bottom: 14px;
  font-size: 11px;
  color: #7a5800;
}

.group {
  margin-bottom: 28px;
  page-break-inside: avoid;
}
.group-header {
  background: #1a3a5c;
  color: #fff;
  padding: 7px 12px;
  border-radius: 4px 4px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.group-title { font-size: 14px; font-weight: 700; }
.group-stock  { font-size: 11px; opacity: 0.85; }

.lamella-note {
  background: #f0f4ff;
  border: 1px solid #c5d0e6;
  padding: 5px 12px;
  font-size: 11px;
  color: #1a3a5c;
}

.sub-title {
  font-size: 11px;
  font-weight: 700;
  color: #1a3a5c;
  margin: 10px 0 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
th, td { border: 1px solid #ddd; padding: 5px 8px; font-size: 11px; }
th { background: #f0f4fa; font-weight: 700; color: #1a3a5c; }
.num { text-align: center; }
.waste { color: #c0392b; }
.bar-no { width: 28px; text-align: center; }
.bar-svg { padding: 3px 6px; }

.summary-row {
  background: #f0f4fa;
  border: 1px solid #c8d8ea;
  border-radius: 0 0 4px 4px;
  padding: 6px 12px;
  display: flex;
  gap: 32px;
  font-size: 11px;
}
.summary-row strong { color: #1a3a5c; }

.order-summary {
  margin-bottom: 28px;
  page-break-inside: avoid;
}
.order-summary-header {
  background: #0f5132;
  color: #fff;
  padding: 7px 12px;
  border-radius: 4px 4px 0 0;
  font-size: 14px;
  font-weight: 700;
}
.order-table { width: 100%; border-collapse: collapse; }
.order-table th, .order-table td { border: 1px solid #ddd; padding: 6px 10px; font-size: 12px; }
.order-table th { background: #e8f5e9; font-weight: 700; color: #0f5132; }
.order-qty { font-size: 14px; font-weight: 700; color: #0f5132; text-align: center; }

.page-foot {
  margin-top: 24px;
  border-top: 1px solid #ccc;
  padding-top: 6px;
  font-size: 10px;
  color: #888;
  display: flex;
  justify-content: space-between;
}
</style>
</head>
<body>
  <div class="page-header">
    <h1>${title}</h1>
    <div class="meta">
      ${t.cut_dims}: ${dimsRow} &nbsp;·&nbsp; ${t.cut_generated}: ${date}
    </div>
  </div>

  ${estimatedWarning}

  ${summaryHtml}

  ${groupsHtml}

  <div class="page-foot">
    <span>${escapeHtml(t.cut_footer)}</span>
    <span>${date}</span>
  </div>
</body>
</html>`
}
