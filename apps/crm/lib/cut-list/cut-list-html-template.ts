import type { CutListResult, ProfileGroup, StockBar, SantafOrderLine } from './calculate-cut-list'
import { KERF_CM } from './calculate-cut-list'
import { getHebrewFontsCss } from '@/lib/pdf/font-loader'

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function fmtCm(cm: number): string {
  const m = cm / 100
  const mStr = Number.isInteger(m) ? `${m}` : m.toFixed(2).replace(/\.?0+$/, '')
  return `${cm} ס״מ (${mStr} מ׳)`
}

function fmtCmShort(cm: number): string {
  return `${Math.round(cm * 10) / 10} ס״מ`
}

/** SVG bar diagram showing cuts + kerf lines inside a stock bar */
function barSvg(bar: StockBar): string {
  const W = 420
  const H = 28
  const scale = W / bar.stockLengthCm
  const kerfW = Math.max(1.5, KERF_CM * scale)

  // Assign a palette of muted colours to each unique label
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
    // Kerf stripe after each cut
    rects.push(
      `<rect x="${x.toFixed(1)}" y="0" width="${kerfW.toFixed(1)}" height="${H}" fill="#555" stroke="none" title="קרף ${KERF_CM} ס״מ"/>`,
    )
    x += KERF_CM * scale
  }

  // Waste block (remaining space after all cuts + kerfs)
  const remaining = W - x
  if (remaining > 0.5) {
    rects.push(
      `<rect x="${x.toFixed(1)}" y="0" width="${remaining.toFixed(1)}" height="${H}" fill="#ddd" stroke="none"/>`,
    )
    if (remaining > 20) {
      rects.push(
        `<text x="${(x + remaining / 2).toFixed(1)}" y="${H / 2 + 4}" text-anchor="middle" font-size="8" fill="#999" font-family="Arial,sans-serif">פסולת</text>`,
      )
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${rects.join('')}</svg>`
}

function profileGroupHtml(g: ProfileGroup, idx: number, lamellaGapCm?: number, lamellaQty?: number): string {
  const piecesRows = g.pieces
    .map(
      (p) => `
      <tr>
        <td>${escapeHtml(p.label)}</td>
        <td class="num">${fmtCmShort(p.lengthCm)}</td>
        <td class="num">${p.qty}</td>
        <td class="num">${fmtCmShort(p.lengthCm * p.qty)}</td>
      </tr>`,
    )
    .join('')

  const barsRows = g.bars
    .map(
      (bar, bi) => `
      <tr>
        <td class="bar-no">${bi + 1}</td>
        <td class="bar-svg">${barSvg(bar)}</td>
        <td class="num">${fmtCmShort(bar.usedCm)}</td>
        <td class="num waste">${fmtCmShort(bar.wasteCm)}</td>
      </tr>`,
    )
    .join('')

  const lamellaNote = (lamellaGapCm !== undefined && lamellaQty !== undefined)
    ? `<div class="lamella-note">מרווח בין הצללות: <strong>${fmtCmShort(lamellaGapCm)}</strong> &nbsp;|&nbsp; כמות הצללות: <strong>${lamellaQty}</strong></div>`
    : ''

  return `
  <div class="group" id="group-${idx}">
    <div class="group-header">
      <span class="group-title">${escapeHtml(g.profileName)}</span>
      <span class="group-stock">מוט סטנדרטי: ${fmtCm(g.stockLengthCm)}</span>
    </div>
    ${lamellaNote}

    <h4 class="sub-title">חתיכות נדרשות</h4>
    <table class="pieces-table">
      <thead>
        <tr>
          <th>חלק</th>
          <th class="num">אורך חתיכה</th>
          <th class="num">כמות</th>
          <th class="num">סה״כ אורך</th>
        </tr>
      </thead>
      <tbody>${piecesRows}</tbody>
    </table>

    <h4 class="sub-title">תכנית חיתוך (${g.totalBars} מוטות)</h4>
    <table class="bars-table">
      <thead>
        <tr>
          <th>#</th>
          <th>תרשים חיתוך</th>
          <th class="num">שימוש</th>
          <th class="num">פסולת</th>
        </tr>
      </thead>
      <tbody>${barsRows}</tbody>
    </table>

    <div class="summary-row">
      <span>סה״כ מוטות לרכישה: <strong>${g.totalBars}</strong></span>
      <span>פסולת כוללת (כולל קרף ${KERF_CM} ס״מ/חיתוך): <strong>${fmtCmShort(g.totalWasteCm)}</strong> (${g.wastePercent.toFixed(1)}%)</span>
    </div>
  </div>`
}

function orderSummaryHtml(result: CutListResult): string {
  const profileRows = result.groups
    .map(
      (g) => `
      <tr>
        <td>${escapeHtml(g.profileName)}</td>
        <td class="num">${fmtCm(g.stockLengthCm)}</td>
        <td class="num order-qty">${g.totalBars}</td>
      </tr>`,
    )
    .join('')

  const santafRows = result.santafLines
    .map(
      (s: SantafOrderLine) => `
      <tr>
        <td>סנטף BH (גליון 104.5 ס״מ)</td>
        <td class="num">${fmtCm(s.lengthCm)}</td>
        <td class="num order-qty">${s.qty}</td>
      </tr>`,
    )
    .join('')

  if (!profileRows && !santafRows) return ''

  return `
  <div class="order-summary">
    <div class="order-summary-header">סיכום הזמנה</div>
    <table class="order-table">
      <thead>
        <tr>
          <th>פריט</th>
          <th class="num">אורך / מוט</th>
          <th class="num">כמות להזמנה</th>
        </tr>
      </thead>
      <tbody>
        ${profileRows}
        ${santafRows}
      </tbody>
    </table>
  </div>`
}

export function renderCutListHtml(result: CutListResult): string {
  const fontsCss = getHebrewFontsCss()
  const date = new Date(result.generatedAt).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const groupsHtml = result.groups.map((g, i) => {
    const isLamella = g.category === 'lamella'
    return profileGroupHtml(
      g, i,
      isLamella ? result.lamellaGapCm : undefined,
      isLamella ? result.lamellaQty : undefined,
    )
  }).join('\n')
  const summaryHtml = orderSummaryHtml(result)

  const estimatedWarning = result.estimated
    ? `<div class="warning">⚠️ נתוני קונפיגורטור חסרים — חישוב מוערך לפי מידות הצעת המחיר בלבד.</div>`
    : ''

  const dimsRow = `${result.widthCm} × ${result.depthCm} ס״מ, גובה ${result.heightCm} ס״מ`

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
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
  direction: rtl;
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
    <h1>רשימת חיתוך — ${escapeHtml(result.customerName)}</h1>
    <div class="meta">
      מידות: ${dimsRow} &nbsp;·&nbsp; הופק: ${date}
    </div>
  </div>

  ${estimatedWarning}

  ${summaryHtml}

  ${groupsHtml}

  <div class="page-foot">
    <span>Pashkovsky Group · רשימת חיתוך אלומיניום</span>
    <span>${date}</span>
  </div>
</body>
</html>`
}
