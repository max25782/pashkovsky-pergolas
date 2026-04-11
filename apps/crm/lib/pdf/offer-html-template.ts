import type { Offer } from '@/types/offer'
import { PERGOLA_TYPE_NAMES } from '@/types/offer'
import { quickOfferRailingsFenceAreaSqm } from '@/lib/offer-calculator'
import { rectanglePlanSvgFragment } from '@/lib/pdf/plan-view-svg'
import { getHebrewFontsCss, getLogoDataUri } from './font-loader'
interface LineRow {
  description: string
  unitLabel: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

/** Safe for double-quoted HTML attributes (e.g. img src data URLs). */
function escapeAttr(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
}

function pdfPrimaryProductKind(offer: Offer): 'pergola' | 'railings' | 'fence' {
  return offer.quickProduct ?? offer.quickOfferExtra?.quickProduct ?? 'pergola'
}

function formatPricePdf(n: number): string {
  const abs = Math.abs(n)
  const formatted = abs.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return n < 0 ? `₪ -${formatted}` : `₪ ${formatted}`
}

function formatDateDdMmYyyy(dateStr: string): string {
  const date = new Date(dateStr)
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
}

function formatOfferNumber(offer: Offer): string {
  const digits = offer.id.replace(/\D/g, '')
  if (digits.length >= 8) return digits.slice(-8)
  if (digits.length >= 6) return digits.padStart(8, '0').slice(-8)
  const t = new Date(offer.createdAt).getTime()
  return String(t % 100000000).padStart(8, '0')
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function colorDescription(offer: Offer): string {
  const c = offer.color
  if (!c) return '—'
  if (c.type === 'ral' && c.ralCode) return `RAL ${c.ralCode}`
  if (c.type === 'wood' && c.woodName) return `דמוי עץ — ${c.woodName}`
  const map: Record<string, string> = {
    white: 'לבן',
    black: 'שחור',
    cream: 'קרם',
    ral: 'RAL',
    wood: 'דמוי עץ',
  }
  return map[c.type] ?? c.type
}

function buildPergolaLineName(offer: Offer, pergolaType?: string | null): string {
  const typeName = pergolaType && pergolaType in PERGOLA_TYPE_NAMES
    ? PERGOLA_TYPE_NAMES[pergolaType as keyof typeof PERGOLA_TYPE_NAMES]
    : 'פרגולה אלומיניום'
  const parts: string[] = [typeName]
  if (offer.shadingRatio) parts.push(`הצללה ${offer.shadingRatio}`)
  if (offer.roof?.type === 'santaf') parts.push('גג סנטף')
  parts.push(`צבע: ${colorDescription(offer)}`)
  return parts.join(' · ')
}

function collectLineRows(offer: Offer): LineRow[] {
  const rows: LineRow[] = []
  const area = offer.area > 0 ? offer.area : 1
  const qp = offer.quickProduct ?? offer.quickOfferExtra?.quickProduct ?? 'pergola'
  const qExtra = offer.quickOfferExtra

  if (qp === 'railings' && qExtra?.quickRailings) {
    const qr = qExtra.quickRailings
    const lineTotal = offer.pergolaTotal ?? 0
    const sqm = quickOfferRailingsFenceAreaSqm(qr.metersTotal, qr.heightCm)
    const up = Math.max(
      0,
      Number(
        (qr as { pricePerSqm?: number; pricePerMeter?: number }).pricePerSqm ??
          (qr as { pricePerMeter?: number }).pricePerMeter,
      ) || 0,
    )
    if (lineTotal > 0 && sqm > 0 && up > 0) {
      const glazingLabels: Record<string, string> = {
        aluminum_glass: 'אלומיניום + זכוכית',
        wet_glazing: 'זיגוג רטוב',
        dry_glazing: 'זיגוג יבש',
      }
      const locLabels: Record<string, string> = {
        balcony: 'מרפסת',
        stairs: 'מדרגות',
        roof: 'גג',
        yard: 'חצר',
        other: 'אחר',
      }
      rows.push({
        description: `מעקות · ${escapeHtml(qr.profileType)} · ${glazingLabels[qr.glazingSystem] ?? qr.glazingSystem} · מיקום: ${locLabels[qr.locationType] ?? qr.locationType} · צבע: ${escapeHtml(qr.color)}`,
        unitLabel: 'מ"ר',
        quantity: Math.round(sqm * 1000) / 1000,
        unitPrice: Math.round(up * 100) / 100,
        lineTotal,
      })
    }
  } else if (qp === 'fence' && qExtra?.quickFence) {
    const qf = qExtra.quickFence
    const lineTotal = offer.pergolaTotal ?? 0
    const sqm = quickOfferRailingsFenceAreaSqm(qf.metersTotal, qf.heightCm)
    const up = Math.max(
      0,
      Number(
        (qf as { pricePerSqm?: number; pricePerMeter?: number }).pricePerSqm ??
          (qf as { pricePerMeter?: number }).pricePerMeter,
      ) || 0,
    )
    const fenceLabels: Record<string, string> = {
      classic: 'גדר קלאסית',
      hitech: 'גדר הייטק',
      hitech_angular: 'גדר הייטק זוויתית',
    }
    if (lineTotal > 0 && sqm > 0 && up > 0) {
      rows.push({
        description: `גדר · ${fenceLabels[qf.fenceVariant] ?? qf.fenceVariant} · צבע: ${escapeHtml(qf.color)}`,
        unitLabel: 'מ"ר',
        quantity: Math.round(sqm * 1000) / 1000,
        unitPrice: Math.round(up * 100) / 100,
        lineTotal,
      })
    }
  } else {
    const pergolas = offer.pergolas || (offer.pergola ? [offer.pergola] : [])
    if (pergolas.length > 0) {
      const { calculatePergolaArea } = require('@/lib/calculations/pergola-area') as typeof import('@/lib/calculations/pergola-area')
      for (const pg of pergolas) {
        if (!pg?.shape) continue
        const pgArea = calculatePergolaArea(pg.shape)
        if (pgArea <= 0 || pg.pricePerSqm <= 0) continue
        rows.push({
          description: buildPergolaLineName(offer, pg.pergolaType),
          unitLabel: 'מ"ר',
          quantity: Math.round(pgArea * 100) / 100,
          unitPrice: pg.pricePerSqm,
          lineTotal: Math.round(pgArea * pg.pricePerSqm * 100) / 100,
        })
      }
    } else if (offer.pergolaTotal != null && offer.pergolaTotal > 0) {
      const up = offer.pergolaTotal / area
      rows.push({
        description: buildPergolaLineName(offer, null),
        unitLabel: 'מ"ר',
        quantity: Math.round(area * 100) / 100,
        unitPrice: Math.round(up * 100) / 100,
        lineTotal: offer.pergolaTotal,
      })
    }
  }

  if (offer.santaf?.enabled && offer.santafTotal > 0) {
    const up = offer.santafTotal / area
    rows.push({
      description: offer.santaf.withStructure ? 'סנטף BH כולל קונסטרוקציה' : 'סנטף BH',
      unitLabel: 'מ"ר',
      quantity: Math.round(area * 100) / 100,
      unitPrice: Math.round(up * 100) / 100,
      lineTotal: offer.santafTotal,
    })
  }

  if (offer.zipScreenTotal > 0) {
    const zm = offer.zipScreen?.runningMeters
    const qty = zm != null && zm > 0 ? zm : area
    const up = offer.zipScreenTotal / (qty || 1)
    rows.push({
      description:
        offer.zipScreen?.type === 'electric'
          ? 'ZIP Screen חשמלי'
          : offer.zipScreen?.type === 'manual'
            ? 'ZIP Screen ידני'
            : 'ZIP Screen',
      unitLabel: zm != null && zm > 0 ? 'ר"מ' : 'מ"ר',
      quantity: Math.round(qty * 100) / 100,
      unitPrice: Math.round(up * 100) / 100,
      lineTotal: offer.zipScreenTotal,
    })
  }

  if (offer.lightingTotal > 0) {
    const rm = offer.lighting?.runningMeters
    const ppm = offer.lighting?.pricePerMeter ?? 200
    const qty = rm != null && rm > 0 ? rm : offer.lightingTotal / ppm
    rows.push({
      description: 'תאורת LED אינטגרלית',
      unitLabel: 'ר"מ',
      quantity: Math.round(qty * 100) / 100,
      unitPrice: ppm,
      lineTotal: offer.lightingTotal,
    })
  }

  if (offer.drainageTotal > 0) {
    const rm = offer.drainage?.runningMeters
    const ppm = offer.drainage?.pricePerMeter ?? 500
    const qty = rm != null && rm > 0 ? rm : offer.drainageTotal / ppm
    rows.push({
      description: 'ניקוז / מרזבים',
      unitLabel: 'ר"מ',
      quantity: Math.round(qty * 100) / 100,
      unitPrice: ppm,
      lineTotal: offer.drainageTotal,
    })
  }

  if (offer.winterClosure?.enabled && offer.winterClosure.items?.length) {
    const typeNames: Record<string, string> = {
      fixedGlass: 'זכוכית קבועה',
      windows7000: 'חלונות 7000',
      windows9000: 'חלונות 9000',
      slidingShowcase7000: 'ויטרינה הזזה 7000',
      slidingShowcase9000: 'ויטרינה הזזה 9000',
      sliderGlass: 'זכוכית סליידר',
      foldingGlass: 'זכוכית מתקפלת',
    }
    const glassTypeNames: Record<string, string> = {
      tempered: 'מחוסם',
      triplex: 'טריפלקס',
      insulated: 'מבודד',
    }
    const glassTypeSuffix =
      offer.winterClosure.glassType ? ` · ${glassTypeNames[offer.winterClosure.glassType] ?? offer.winterClosure.glassType}` : ''
    for (const item of offer.winterClosure.items) {
      const name = typeNames[item.type] ?? item.type
      const note = item.notes ? ` (${item.notes})` : ''
      rows.push({
        description: `סגירת חורף — ${name}${glassTypeSuffix}${note}`,
        unitLabel: 'מ"ר',
        quantity: Math.round(item.area * 100) / 100,
        unitPrice: item.pricePerSqm,
        lineTotal: item.area * item.pricePerSqm,
      })
    }
  }

  return rows
}

function formatSinglePergolaDimensionsHtml(pergola: Offer['pergola'], index?: number): string {
  if (!pergola) return ''
  const typeLabel = pergola.pergolaType && pergola.pergolaType in PERGOLA_TYPE_NAMES
    ? PERGOLA_TYPE_NAMES[pergola.pergolaType as keyof typeof PERGOLA_TYPE_NAMES]
    : null
  const headingText = index !== undefined
    ? `פרגולה ${index + 1}${typeLabel ? ` — ${typeLabel}` : ''}`
    : typeLabel ?? null
  const prefix = headingText !== null
    ? `<tr><td colspan="2" class="tech-h">${escapeHtml(headingText)}</td></tr>`
    : ''
  const shape = pergola.shape
  if (!shape) {
    return (
      prefix +
      `<tr><td>רוחב × אורך</td><td>${pergola.width ?? '—'} × ${pergola.length ?? '—'} מ׳</td></tr>`
    )
  }
  switch (shape.type) {
    case 'rectangle':
      return (
        prefix +
        `<tr><td>צורה</td><td>מלבן</td></tr>
         <tr><td>רוחב × אורך</td><td>${shape.width} × ${shape.length} מ׳</td></tr>`
      )
    case 'L':
      return (
        prefix +
        `<tr><td>צורה</td><td>L</td></tr>
         <tr><td>רגל 1</td><td>${shape.leg1.width} × ${shape.leg1.length} מ׳</td></tr>
         <tr><td>רגל 2</td><td>${shape.leg2.width} × ${shape.leg2.length} מ׳</td></tr>`
      )
    case 'X':
      return (
        prefix +
        `<tr><td>צורה</td><td>X</td></tr>
         <tr><td>מרכז</td><td>${shape.center.width} × ${shape.center.length} מ׳</td></tr>
         ${shape.arms
           .map(
             (a, i) =>
               `<tr><td>זרוע ${i + 1}</td><td>${escapeHtml(a.direction)} — ${a.width} × ${a.length} מ׳</td></tr>`,
           )
           .join('')}`
      )
    case 'U':
      return (
        prefix +
        `<tr><td>צורה</td><td>U</td></tr>
         <tr><td>בסיס</td><td>${shape.base.width} × ${shape.base.length} מ׳</td></tr>
         <tr><td>רגל שמאל</td><td>${shape.leftLeg.width} × ${shape.leftLeg.length} מ׳</td></tr>
         <tr><td>רגל ימין</td><td>${shape.rightLeg.width} × ${shape.rightLeg.length} מ׳</td></tr>`
      )
    default:
      return prefix
  }
}

function formatAllPergolasTechnicalHtml(offer: Offer): string {
  const pk = pdfPrimaryProductKind(offer)
  const qx = offer.quickOfferExtra

  if (pk === 'railings' && qx?.quickRailings) {
    const qr = qx.quickRailings
    const sqm = quickOfferRailingsFenceAreaSqm(qr.metersTotal, qr.heightCm)
    const glazingLabels: Record<string, string> = {
      aluminum_glass: 'אלומיניום + זכוכית',
      wet_glazing: 'זיגוג רטוב',
      dry_glazing: 'זיגוג יבש',
    }
    const locLabels: Record<string, string> = {
      balcony: 'מרפסת',
      stairs: 'מדרגות',
      roof: 'גג',
      yard: 'חצר',
      other: 'אחר',
    }
    return `
    <tr><td colspan="2" class="tech-h">מעקות — מפרט</td></tr>
    <tr><td>אורך</td><td>${escapeHtml(String(qr.metersTotal))} מ׳</td></tr>
    <tr><td>גובה</td><td>${qr.heightCm != null ? escapeHtml(String(qr.heightCm)) : '—'} ס״מ</td></tr>
    <tr><td>שטח משוער</td><td>${sqm.toFixed(2)} מ״ר</td></tr>
    <tr><td>פרופיל</td><td>${escapeHtml(qr.profileType || '—')}</td></tr>
    <tr><td>צבע</td><td>${escapeHtml(qr.color || '—')}</td></tr>
    <tr><td>מיקום</td><td>${escapeHtml(locLabels[qr.locationType] ?? qr.locationType)}</td></tr>
    <tr><td>זיגוג</td><td>${escapeHtml(glazingLabels[qr.glazingSystem] ?? qr.glazingSystem)}</td></tr>
    ${qr.glassType ? `<tr><td>פירוט זכוכית</td><td>${escapeHtml(qr.glassType)}</td></tr>` : ''}
    ${qr.notes ? `<tr><td>הערות</td><td>${escapeHtml(qr.notes)}</td></tr>` : ''}`
  }

  if (pk === 'fence' && qx?.quickFence) {
    const qf = qx.quickFence
    const sqm = quickOfferRailingsFenceAreaSqm(qf.metersTotal, qf.heightCm)
    const fenceLabels: Record<string, string> = {
      classic: 'קלאסי',
      hitech: 'הייטק',
      hitech_angular: 'הייטק זוויתי',
    }
    return `
    <tr><td colspan="2" class="tech-h">גדר — מפרט</td></tr>
    <tr><td>אורך</td><td>${escapeHtml(String(qf.metersTotal))} מ׳</td></tr>
    <tr><td>גובה</td><td>${qf.heightCm != null ? escapeHtml(String(qf.heightCm)) : '—'} ס״מ</td></tr>
    <tr><td>שטח משוער</td><td>${sqm.toFixed(2)} מ״ר</td></tr>
    <tr><td>סוג גדר</td><td>${escapeHtml(fenceLabels[qf.fenceVariant] ?? qf.fenceVariant)}</td></tr>
    <tr><td>צבע</td><td>${escapeHtml(qf.color || '—')}</td></tr>
    ${qf.notes ? `<tr><td>הערות</td><td>${escapeHtml(qf.notes)}</td></tr>` : ''}`
  }

  const pergolas = offer.pergolas || (offer.pergola ? [offer.pergola] : [])
  if (pergolas.length === 0) return '<tr><td colspan="2">ללא פרגולה בפריט</td></tr>'
  return pergolas.map((p, i) => formatSinglePergolaDimensionsHtml(p, pergolas.length > 1 ? i : undefined)).join('')
}

function customer3dViewerHref(meta: Offer['configuratorMeta']): string | null {
  if (meta?.viewUrl?.startsWith('http')) return meta.viewUrl
  const e = meta?.editUrl
  if (!e?.startsWith('http')) return null
  return e.includes('view=1') ? e : `${e}${e.includes('?') ? '&' : '?'}view=1`
}

function hasRenderableSignatureImage(sig: string | null | undefined): boolean {
  if (sig === undefined || sig === null || sig === '') return false
  return (
    sig.startsWith('data:image/') || sig.startsWith('http://') || sig.startsWith('https://')
  )
}

/** חתימת לקוח: embedded digital signature when approved on the public approve page. */
function customerSignatureSectionHtml(offer: Offer, offerNo: string, docDate: string): string {
  const a = offer.approval
  const sig = a?.signatureImage
  const digital =
    a?.approved === true && hasRenderableSignatureImage(sig)

  if (digital) {
    const approvedDate =
      a?.approvedAt !== undefined && a.approvedAt !== ''
        ? formatDateDdMmYyyy(a.approvedAt)
        : docDate
    const name = escapeHtml(a?.customerName ?? offer.customerName ?? '')
    const phoneRaw = a?.customerPhone ?? offer.customerPhone
    const phone = phoneRaw ? escapeHtml(phoneRaw) : ''
    const src = escapeAttr(sig as string)

    return `
  <div class="sign sign--digital">
    <div class="title">חתימת לקוח — חתימה דיגיטלית</div>
    <div class="sign-meta"><strong>שם החותם/ת:</strong> ${name}${
      phone !== '' ? ` · <strong>טל׳:</strong> ${phone}` : ''
    }</div>
    <div class="sign-meta"><strong>תאריך אישור:</strong> ${escapeHtml(approvedDate)}</div>
    <div class="sign-img-wrap">
      <img src="${src}" alt="" class="sign-img" />
    </div>
    <div class="hint">אני מאשר/ת את תנאי ההצעה · חתימה אלקטרונית נרשמה במערכת · הצעה מס׳ ${escapeHtml(offerNo)}</div>
  </div>`
  }

  return `
  <div class="sign">
    <div class="title">חתימת לקוח</div>
    <div class="hint">
      לאישור דיגיטלי: פתחו את קישור ההצעה שנשלח אליכם, חתמו במסך ושמרו — לאחר מכן הורידו מחדש את קובץ ה־PDF לקבלת העתק עם החתימה.
    </div>
    <div class="hint" style="margin-top:10px;">
      אישור ידני: אני מאשר/ת את תנאי ההצעה · תאריך: ___________
    </div>
    <div class="hint" style="margin-top:16px;">
      הצעת מחיר ${escapeHtml(offerNo)} · ${docDate}
    </div>
  </div>`
}

/**
 * Renders a table of 3D configurator technical parameters (profiles, options) for the PDF.
 */
function configuratorParamsTechHtml(offer: Offer): string {
  const p = offer.configuratorMeta?.params
  if (!p) return ''

  const rows: [string, string][] = []

  rows.push(['רוחב', `${p.widthCm} ס"מ`])
  rows.push(['עומק', `${p.depthCm} ס"מ`])
  rows.push(['גובה', `${p.heightCm} ס"מ`])

  if (p.postProfileId) rows.push(['פרופיל עמוד', escapeHtml(p.postProfileId)])
  if (p.beamProfileId) rows.push(['פרופיל קורה', escapeHtml(p.beamProfileId)])
  if (p.lamellaProfileId) rows.push(['פרופיל למילה', escapeHtml(p.lamellaProfileId)])

  rows.push(['מרווח בין למילות', `${p.lamellaGapCm} ס"מ`])
  if (p.lamellaAngleDeg !== 0) rows.push(['זווית למילה', `${p.lamellaAngleDeg}°`])
  if (p.lamellaStanding) rows.push(['למילות בעמידה', 'כן'])
  if (p.lamellaAlongWidth) rows.push(['למילות לאורך הרוחב', 'כן'])
  if (p.beamLed) rows.push(['תאורת LED בקורות', 'כן'])
  if (p.attachedToWall) rows.push(['מחובר לקיר', 'כן'])

  if (rows.length === 0) return ''

  const trs = rows.map(([label, val]) => `<tr><td>${label}</td><td>${val}</td></tr>`).join('\n    ')
  return `
  <h3 class="tech-subtitle">פרמטרים מהקונפיגורטור התלת־ממדי</h3>
  <table class="tech">
    ${trs}
  </table>`
}

/**
 * Technical appendix block — aligned with classic quote PDFs: "הדמיה מוצר" + schematic area on מפרט טכני.
 * @param previewImageDataUrl - Optional pre-fetched base64 data URL for the 3D preview image.
 *   Pass this to avoid Puppeteer being unable to load external URLs during PDF generation.
 */
function configuratorTechnicalAppendixHtml(offer: Offer, previewImageDataUrl?: string | null): string {
  const pk = pdfPrimaryProductKind(offer)
  const meta = offer.configuratorMeta
  let img: string | null = null
  // Prefer pre-fetched base64 data URL (works in Puppeteer without network access)
  if (pk === 'pergola') {
    if (previewImageDataUrl?.startsWith('data:image/')) img = previewImageDataUrl
    else if (meta?.previewImageUrl?.startsWith('http')) img = meta.previewImageUrl
    else if (offer.images?.[0]?.startsWith('http')) img = offer.images[0]
  }
  const link = pk === 'pergola' ? customer3dViewerHref(meta) : null
  const planSvg = rectanglePlanSvgFragment(offer)
  const hasViz = img !== null || link !== null
  const hasPlan = planSvg !== ''
  if (!hasViz && !hasPlan) return ''

  const pergolas = offer.pergolas || (offer.pergola ? [offer.pergola] : [])
  const pergolaHeading =
    pergolas.length === 0
      ? 'פרגולה'
      : pergolas.length === 1
        ? '1 · פרגולה'
        : `${pergolas.length} · פרגולות`

  let body = ''
  if (img !== null) {
    body += `<div class="viz-img-wrap"><img src="${escapeAttr(img)}" alt="הדמיית פרגולה" /></div>`
  }
  if (link !== null) {
    body += `<div class="viz-link"><a href="${escapeHtml(link)}">פתיחת תצוגה תלת־ממדית אינטראקטיבית</a></div>`
    body +=
      '<div class="viz-note">לצפייה והסתכלות בלבד · ניתן לסובב את המודל · התאמות נעשות דרך נציג מכירות בלבד</div>'
  }

  let schematicInner = ''
  if (hasPlan) {
    schematicInner += `<div class="viz-plan-svg-wrap">${planSvg}</div>`
    schematicInner +=
      '<p class="viz-schematic-note">תרשים מבט על — מידות לפי שורת הפרגולה בהצעה (צורה מלבנית).</p>'
  }
  if (img !== null) {
    schematicInner += `<p class="viz-schematic-note">התמונה בהדמיה למעלה נלקחה מתצוגת התכנון התלת־ממדי ומשקפת את הגימור כפי שהוגדר בהצעה.</p>`
  }
  if (link !== null) {
    schematicInner += `<p class="viz-schematic-note">לסיבוב מלא של המודל ולצפייה מזוויות נוספות — השתמשו בקישור בבלוק &quot;הדמיה מוצר&quot;.</p>`
  }

  const vizBlock = hasViz
    ? `
  <div class="viz-section">
    <div class="viz-section-title">הדמיה מוצר ותצוגה תלת־ממדית</div>
    <div class="viz-section-body">${body}</div>
  </div>`
    : ''

  return `
  <p class="viz-pergola-line">${escapeHtml(pergolaHeading)}</p>
  ${vizBlock}
  <div class="viz-section viz-schematic">
    <div class="viz-section-title">תרשים / תצוגה הנדסית</div>
    <div class="viz-section-body viz-schematic-body">
      ${schematicInner}
    </div>
  </div>`
}

function winterClosureTechRows(offer: Offer): string {
  const wc = offer.winterClosure
  if (!wc?.enabled || !wc.items?.length) return ''

  const typeNames: Record<string, string> = {
    fixedGlass: 'זכוכית קבועה',
    windows7000: 'חלונות 7000',
    windows9000: 'חלונות 9000',
    slidingShowcase7000: 'ויטרינה הזזה 7000',
    slidingShowcase9000: 'ויטרינה הזזה 9000',
    sliderGlass: 'זכוכית סליידר',
    foldingGlass: 'זכוכית מתקפלת',
  }
  const glassTypeNames: Record<string, string> = {
    tempered: 'מחוסם',
    triplex: 'טריפלקס',
    insulated: 'מבודד',
  }

  const glassTypeLabel = wc.glassType ? glassTypeNames[wc.glassType] ?? wc.glassType : null

  let rows = `<tr><td colspan="2" class="tech-h">סגירת חורף (זכוכית)</td></tr>`
  if (glassTypeLabel) {
    rows += `<tr><td>סוג זכוכית</td><td>${escapeHtml(glassTypeLabel)}</td></tr>`
  }
  for (const item of wc.items) {
    const name = typeNames[item.type] ?? item.type
    const note = item.notes ? ` · ${item.notes}` : ''
    rows += `<tr><td>${escapeHtml(name)}${escapeHtml(note)}</td><td>${(Math.round(item.area * 100) / 100).toFixed(2)} מ״ר</td></tr>`
  }
  return rows
}

/**
 * Render HTML template for offer (הצעת מחיר) — layout aligned with classic Israeli quote PDFs:
 * header + offer no. + validity, לכבוד, priced line table, VAT summary, signature, technical appendix page.
 *
 * @param omitSignatureSection - when true the signature block is replaced with an empty placeholder
 *   (used by the digital approval page which renders its own interactive signature pad below the iframe).
 */
export function renderOfferHtml(
  offer: Offer,
  previewImageDataUrl?: string | null,
  omitSignatureSection = false,
): string {
  const fontsCss = getHebrewFontsCss()
  const logoDataUri = getLogoDataUri()
  const notesText = offer.options?.notes?.trim() || ''
  const safeNotes = notesText ? escapeHtml(notesText) : ''

  const offerNo = formatOfferNumber(offer)
  const docDate = formatDateDdMmYyyy(offer.createdAt)
  const validUntil = formatDateDdMmYyyy(addDaysIso(offer.createdAt, 30))
  const lineRows = collectLineRows(offer)
  const pdfPk = pdfPrimaryProductKind(offer)
  const areaRowLabel =
    pdfPk === 'railings' || pdfPk === 'fence' ? 'שטח (מ״ר, אורך × גובה)' : 'שטח פרגולה (חישוב)'

  const linesHtml =
    lineRows.length > 0
      ? lineRows
          .map(
            (r) => `
    <tr>
      <td class="col-desc">${escapeHtml(r.description)}</td>
      <td class="col-unit">${escapeHtml(r.unitLabel)}</td>
      <td class="col-num">${r.quantity.toLocaleString('he-IL', { maximumFractionDigits: 2 })}</td>
      <td class="col-num">${formatPricePdf(r.unitPrice)}</td>
      <td class="col-num">${formatPricePdf(r.lineTotal)}</td>
    </tr>`,
          )
          .join('')
      : `<tr><td colspan="5" class="col-desc">אין שורות מחיר — בדוק את ההצעה במערכת</td></tr>`

  const discountRow =
    offer.discountAmount > 0
      ? `
    <tr class="row-section">
      <td colspan="5">מוצרים נוספים</td>
    </tr>
    <tr>
      <td class="col-desc">הנחה${offer.discountPercent > 0 ? ` (${offer.discountPercent}%)` : ''}</td>
      <td class="col-unit">יח׳</td>
      <td class="col-num">1</td>
      <td class="col-num">${formatPricePdf(-offer.discountAmount)}</td>
      <td class="col-num">${formatPricePdf(-offer.discountAmount)}</td>
    </tr>`
      : ''

  const vatPct = offer.vatPercent ?? 18

  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <title>הצעת מחיר ${escapeHtml(offerNo)}</title>
  <style>
    ${fontsCss}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Noto Sans Hebrew', 'Segoe UI', Tahoma, sans-serif;
      direction: rtl;
      color: #111;
      font-size: 11px;
      line-height: 1.45;
      padding: 10mm 12mm;
    }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo { max-height: 52px; max-width: 120px; object-fit: contain; }
    .brand-text .name { font-size: 18px; font-weight: 700; }
    .brand-text .sub { font-size: 10px; color: #333; margin-top: 2px; }
    .meta {
      text-align: left;
      direction: rtl;
      font-size: 10px;
      min-width: 200px;
    }
    .meta div { margin-bottom: 3px; }
    .meta .big { font-size: 14px; font-weight: 700; margin-top: 6px; }
    .customer {
      margin: 14px 0 12px;
      font-size: 12px;
    }
    .customer .label { color: #333; }
    .customer .name { font-weight: 700; font-size: 14px; margin-top: 4px; }
    table.lines {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0 14px;
    }
    table.lines th,
    table.lines td {
      border: 1px solid #222;
      padding: 6px 8px;
      vertical-align: top;
    }
    table.lines th {
      background: #f0f0f0;
      font-weight: 700;
      font-size: 10px;
    }
    .col-desc { width: 38%; text-align: right; }
    .col-unit { width: 10%; text-align: center; }
    .col-num { width: 14%; text-align: left; direction: ltr; unicode-bidi: embed; }
    tr.row-section td {
      font-weight: 700;
      background: #fafafa;
    }
    table.summary {
      width: 100%;
      max-width: 320px;
      margin: 0 0 16px auto;
      border-collapse: collapse;
    }
    table.summary td {
      padding: 5px 8px;
      border: 1px solid #222;
    }
    table.summary td:first-child { font-weight: 600; background: #f5f5f5; }
    table.summary td:last-child {
      text-align: left;
      direction: ltr;
      unicode-bidi: embed;
      font-weight: 700;
    }
    .sign {
      margin-top: 20px;
      padding: 12px;
      border: 1px solid #999;
      min-height: 100px;
    }
    .sign .title { font-weight: 700; margin-bottom: 8px; }
    .sign .hint { font-size: 9px; color: #444; margin-top: 8px; }
    .sign--digital { border-color: #333; background: #fafafa; }
    .sign-meta { font-size: 10px; margin: 4px 0; line-height: 1.4; }
    .sign-img-wrap {
      margin-top: 10px;
      text-align: center;
      padding: 10px;
      border: 1px solid #ccc;
      background: #fff;
      min-height: 72px;
    }
    .sign-img {
      max-height: 100px;
      max-width: 100%;
      object-fit: contain;
    }
    .page-foot {
      margin-top: 14px;
      font-size: 9px;
      color: #555;
      border-top: 1px solid #ccc;
      padding-top: 6px;
      display: flex;
      justify-content: space-between;
    }
    .notes-box {
      margin: 12px 0;
      padding: 10px;
      border: 1px dashed #888;
      font-size: 10px;
      white-space: pre-wrap;
    }
    .page-break { page-break-before: always; }
    h2.tech-title {
      font-size: 15px;
      margin: 8px 0 12px;
      border-bottom: 2px solid #000;
      padding-bottom: 6px;
    }
    h3.tech-subtitle {
      font-size: 13px;
      margin: 14px 0 6px;
      color: #333;
      border-bottom: 1px solid #ccc;
      padding-bottom: 4px;
    }
    table.tech {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    table.tech td {
      border: 1px solid #222;
      padding: 6px 8px;
    }
    table.tech td:first-child {
      width: 32%;
      font-weight: 600;
      background: #f5f5f5;
    }
    .tech-h { font-weight: 700; background: #eee !important; }
    .terms { font-size: 9px; color: #333; margin-top: 10px; }
    .terms strong { display: block; margin-bottom: 4px; }
    .viz-section {
      margin: 14px 0 0;
      border: 1px solid #222;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .viz-section-title {
      background: #e8e8e8;
      border-bottom: 1px solid #222;
      padding: 8px 10px;
      font-size: 11px;
      font-weight: 700;
    }
    .viz-section-body {
      padding: 12px 10px;
      background: #fafafa;
    }
    .viz-img-wrap {
      text-align: center;
      margin-bottom: 10px;
    }
    .viz-img-wrap img {
      max-width: 100%;
      max-height: 300px;
      width: auto;
      height: auto;
      object-fit: contain;
      border: 1px solid #ccc;
      background: #fff;
    }
    .viz-link {
      text-align: center;
      font-size: 11px;
      margin: 8px 0 4px;
    }
    .viz-link a { color: #0b57d0; font-weight: 600; }
    .viz-note {
      text-align: center;
      font-size: 9px;
      color: #444;
      line-height: 1.4;
      max-width: 520px;
      margin: 0 auto;
    }
    .viz-schematic .viz-section-body { background: #fff; padding: 10px 12px; }
    .viz-schematic-note {
      font-size: 9px;
      color: #333;
      margin: 0 0 6px;
      line-height: 1.45;
    }
    .viz-pergola-line {
      font-size: 12px;
      font-weight: 700;
      margin: 10px 0 6px;
      padding-bottom: 4px;
      border-bottom: 1px solid #bbb;
    }
    .viz-plan-svg-wrap {
      text-align: center;
      margin: 6px 0 10px;
    }
    .viz-plan-svg-wrap svg {
      max-width: 100%;
      height: auto;
      border: 1px solid #ccc;
      background: #fff;
    }
  </style>
</head>
<body>
  <div class="top">
    <div class="brand">
      ${logoDataUri ? `<img class="logo" src="${logoDataUri}" alt="" />` : ''}
      <div class="brand-text">
        <div class="name">Pashkovsky Group</div>
        <div class="sub">פתרונות אלומיניום · pergolas · מעקות · חיפוי</div>
        <div class="sub">טל׳ 052-449-4848 · office@pashkovsky-group.com</div>
      </div>
    </div>
    <div class="meta">
      <div>ח.פ / ע.מ: <strong>320807068</strong></div>
      <div class="big">הצעת מחיר ${escapeHtml(offerNo)}</div>
      <div><strong>תאריך:</strong> ${docDate}</div>
      <div><strong>תוקף עד:</strong> ${validUntil}</div>
    </div>
  </div>

  <div class="customer">
    <div class="label">לכבוד</div>
    <div class="name">${escapeHtml(offer.customerName)}</div>
    ${
      offer.customerPhone
        ? `<div style="margin-top:4px;font-size:11px;">טל׳: ${escapeHtml(offer.customerPhone)}${
            offer.customerCity ? ` · ${escapeHtml(offer.customerCity)}` : ''
          }</div>`
        : ''
    }
  </div>

  ${safeNotes ? `<div class="notes-box"><strong>הערות / תיאור:</strong><br/>${safeNotes}</div>` : ''}

  <table class="lines">
    <thead>
      <tr>
        <th>תיאור / מוצר</th>
        <th>מידה</th>
        <th>כמות</th>
        <th>מחיר</th>
        <th>סה״כ</th>
      </tr>
    </thead>
    <tbody>
      ${linesHtml}
      ${discountRow}
    </tbody>
  </table>

  <table class="summary">
    <tr><td>מע״מ לפני סה״כ</td><td>${formatPricePdf(offer.totalBeforeVat)}</td></tr>
    <tr><td>מע״מ (${vatPct}%)</td><td>${formatPricePdf(offer.vatAmount)}</td></tr>
    <tr><td>מע״מ כולל סה״כ</td><td>${formatPricePdf(offer.priceWithVat)}</td></tr>
    ${
      offer.discountAmount > 0
        ? `<tr><td>לאחר הנחה — לתשלום</td><td>${formatPricePdf(offer.finalPrice)}</td></tr>`
        : ''
    }
  </table>

  ${omitSignatureSection ? '' : customerSignatureSectionHtml(offer, offerNo, docDate)}

  <div class="page-foot">
    <span>Pashkovsky Group · www.pashkovsky-group.com</span>
    <span>עמ׳ 1 מתוך 2</span>
  </div>

  <div class="page-break"></div>

  <h2 class="tech-title">מפרט טכני</h2>
  <table class="tech">
    <tr><td>גימור / צבע</td><td>${escapeHtml(colorDescription(offer))}</td></tr>
    <tr><td>גג</td><td>${offer.roof?.type === 'santaf' ? 'סנטף' : offer.roof?.type === 'triplexGlass' ? 'זכוכית טריפלקס' : '—'}</td></tr>
    <tr><td>יחס הצללה</td><td>${offer.shadingRatio ? escapeHtml(offer.shadingRatio) : '—'}</td></tr>
    <tr><td>סוג גימור</td><td>${offer.finishType ? escapeHtml(offer.finishType) : '—'} ${offer.finishValue ? `· ${escapeHtml(offer.finishValue)}` : ''}</td></tr>
    <tr><td>${escapeHtml(areaRowLabel)}</td><td>${offer.area.toFixed(2)} מ״ר</td></tr>
    ${winterClosureTechRows(offer)}
  </table>

  <table class="tech">
    ${formatAllPergolasTechnicalHtml(offer)}
  </table>

  ${pdfPk === 'pergola' ? configuratorParamsTechHtml(offer) : ''}

  ${configuratorTechnicalAppendixHtml(offer, previewImageDataUrl)}

  <div class="terms">
    <strong>תנאים כלליים</strong>
    ${escapeHtml(offer.paymentTerms?.text || '10% מקדמה וכל השאר בסיום התקנה בהעברה בנקאית')}
    <br/>תוקף ההצעה 30 יום מתאריך ההנפקה · אחריות ${offer.warranty?.years ?? 7} שנים: ${(offer.warranty?.covers || []).join(', ')}
  </div>

  <div class="page-foot">
    <span>הצעת מחיר ${escapeHtml(offerNo)}</span>
    <span>עמ׳ 2 מתוך 2</span>
  </div>
</body>
</html>
`.trim()
}
