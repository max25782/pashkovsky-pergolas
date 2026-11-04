import { getAuthHeaders } from '@/lib/api/auth-fetch'

const COPIED_STYLE = [
  'display', 'position', 'flex-direction', 'flex-wrap', 'flex', 'align-items', 'justify-content',
  'gap', 'width', 'height', 'min-width', 'max-width', 'padding', 'margin', 'border',
  'border-color', 'font', 'font-size', 'font-family', 'font-weight',
  'text-align', 'line-height', 'white-space', 'box-sizing',
] as const

function inlineTree(source: Element, clone: Element): void {
  if (clone.namespaceURI === 'http://www.w3.org/2000/svg') {
    if (source instanceof SVGSVGElement && clone instanceof SVGSVGElement) {
      const box = source.getBoundingClientRect()
      if (box.width > 0 && box.height > 0) {
        clone.setAttribute('width', String(Math.round(box.width)))
        clone.setAttribute('height', String(Math.round(box.height)))
      }
    }
    return
  }
  if (source instanceof HTMLElement && clone instanceof HTMLElement) {
    const computed = getComputedStyle(source)
    const previous = clone.getAttribute('style') ?? ''
    const additions = COPIED_STYLE.map((name) => `${name}:${computed.getPropertyValue(name)}`).join(';')
    clone.setAttribute('style', `${previous};${additions};color:#171717`)
  }
  const sourceChildren = [...source.children]
  const cloneChildren = [...clone.children]
  for (let i = 0; i < sourceChildren.length; i++) {
    const next = cloneChildren[i]
    if (next) inlineTree(sourceChildren[i], next)
  }
}

function pageHtml(page: HTMLElement): string {
  const orient = page.dataset.pdfOrient === 'port' ? 'port' : 'land'
  const clone = page.cloneNode(true) as HTMLElement
  if (page.dataset.pdfKind !== 'html') inlineTree(page, clone)
  clone.classList.add(orient)
  clone.removeAttribute('data-pdf-page')
  return clone.outerHTML
}

export function sheetPdfDocument(root: HTMLElement, locale: 'he' | 'ru' | 'en' | 'sr'): string {
  const dir = locale === 'he' ? 'rtl' : 'ltr'
  const pages = [...root.querySelectorAll<HTMLElement>('[data-pdf-page]')]
  const firstLandscape = pages[0]?.dataset.pdfOrient !== 'port'
  const firstSize = firstLandscape ? 'A4 landscape' : 'A4 portrait'
  const firstMargin = firstLandscape ? '8mm' : '10mm'
  const hebrewFont = locale === 'he'
    ? 'font-family:"Arial Hebrew","Noto Sans Hebrew",David,Arial,sans-serif;'
    : ''
  return `<!DOCTYPE html>
<html dir="${dir}" lang="${locale}">
<head>
<meta charset="utf-8"/>
<style>
  @page { size: ${firstSize}; margin: ${firstMargin}; }
  @page land { size: A4 landscape; margin: 8mm; }
  @page port { size: A4 portrait; margin: 10mm; }
  html, body { margin: 0; background: #fff; color: #111; ${hebrewFont} }
  .land { page: land; width: 281mm; height: 194mm; overflow: hidden; break-after: page; display: flex; direction: ltr; background: #fff; }
  .port { page: port; width: 190mm; min-height: 270mm; overflow: hidden; break-after: page; background: #fff; box-sizing: border-box; }
  .plan-slot { flex: 1; min-width: 0; height: 194mm; }
  .plan-slot svg, .layout-slot svg { width: 100%; height: 100%; display: block; }
  .layout-slot, .sections-slot, .sections-slot svg { width: 281mm; height: 194mm; display: block; }
  aside { width: 58mm; flex: none; border-inline-start: 0.3mm solid #e5e5e5; padding: 4mm; font: 11pt sans-serif; box-sizing: border-box; }
  h1 { margin: 0 0 3mm; font: 700 14pt sans-serif; line-height: 1.3; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border-bottom: 0.2mm solid #ddd; padding: 1mm 2mm; font: 11pt sans-serif; text-align: start; }
  table.totals { width: 100%; }
  table.totals th:nth-child(1), table.totals td:nth-child(1) { width: 28%; }
  table.totals th.num, table.totals td.num { width: 24%; text-align: end; }
  table.totals tr.total td { font-weight: 700; border-top: 0.4mm solid #111; }
  .ltr { direction: ltr; unicode-bidi: isolate; display: inline-block; }
  .note { font: 10pt sans-serif; margin: 0 0 3mm; }
  .weight-warn { color: #b91c1c; font: 700 11pt sans-serif; margin: 0 0 3mm; }
  .exclude { font-weight: 700; }
  .cut-page, .order-page { font-size: 10pt; }
  .profile-head, .order-card { display: flex; gap: 4mm; align-items: center; margin: 0 0 3mm; break-inside: avoid; }
  .profile-head img, .profile-head .schematic, .order-card img, .order-card .schematic { width: 28mm; height: 22mm; object-fit: contain; border: 0.2mm solid #d6d3d1; background: #fff; flex: none; }
  .profile-head p, .order-card p { margin: 1mm 0 0; font-size: 10pt; }
  .profile-head strong, .order-card strong { font-size: 14pt; }
  .missing-photo { width: 36mm; flex: none; }
  .no-photo { margin: 0 0 1mm; font-weight: 700; }
  .bar-row { display: flex; align-items: center; gap: 2mm; margin: 0 0 2mm; break-inside: avoid; }
  .lamella-dense h1 { margin-bottom: 1mm; font-size: 12pt; }
  .lamella-dense .profile-head { margin-bottom: 2mm; }
  .lamella-dense .profile-head img, .lamella-dense .profile-head .schematic { width: 22mm; height: 16mm; }
  .lamella-dense .bar { height: 15mm; }
  .lamella-dense .bar-row { gap: 2mm; margin: 0 0 1mm; }
  .times { width: 14mm; font: 700 12pt sans-serif; direction: ltr; flex: none; }
  .legend { font-size: 10pt; border-top: 0.3mm solid #111; margin-top: 3mm; padding-top: 2mm; }
  .legend p { margin: 0 0 1mm; }
  bdi, [dir="ltr"] { unicode-bidi: isolate; }
  * { box-sizing: border-box; }
</style>
</head>
<body>${pages.map(pageHtml).join('')}</body>
</html>`
}

export async function downloadSheetPdf(
  root: HTMLElement,
  filename: string,
  locale: 'he' | 'ru' | 'en' | 'sr',
): Promise<void> {
  const headers = await getAuthHeaders()
  const response = await fetch('/api/plan-sheets-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ html: sheetPdfDocument(root, locale), filename }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `PDF failed (${response.status})`)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
