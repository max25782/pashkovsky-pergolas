import type { Offer } from '@/types/offer'
import { quickOfferRailingsFenceAreaSqm } from '@/lib/offer-calculator'
import {
  resolveQuickOfferIncludes,
  resolveQuickOfferIncludesFromExtra,
} from '@/lib/quick-offer-includes'
import { rectanglePlanSvgFragment } from '@/lib/pdf/plan-view-svg'
import { getHebrewFontsCss, getLogoDataUri } from './font-loader'
import { pdfT, resolvePdfLocale, pdfHtmlDir, pdfBcp47Locale, pdfCurrencySymbol, type PdfDict } from '@/lib/pdf/offer-pdf-i18n'
import { OFFER_TERMS_BODIES } from '@/lib/pdf/offer-terms-bodies'

function fillTpl(s: string, vars: Record<string, string | number>): string {
  let out = s
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, String(v))
  }
  return out
}

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

function makePriceFormatter(symbol: string) {
  return function formatPricePdf(n: number): string {
    const abs = Math.abs(n)
    const formatted = abs.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return n < 0 ? `${symbol} -${formatted}` : `${symbol} ${formatted}`
  }
}

function formatDateDdMmYyyy(dateStr: string): string {
  const date = new Date(dateStr)
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
}

function formatOfferNumber(offer: Offer): string {
  const digits = offer.id.replace(/\D/g, '')
  if (digits.length >= 8) return digits.slice(-8)
  if (digits.length >= 6) return digits.padStart(8, '0').slice(-8)
  const ts = new Date(offer.createdAt).getTime()
  return String(ts % 100000000).padStart(8, '0')
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

/** Pergola type label for PDF (uses `pdf-translations`, not CRM Hebrew constants). */
function pergolaProductTypeLabel(pergolaType: string | null | undefined, dict: PdfDict): string {
  if (pergolaType === 'fixed') return dict.off_pergola_type_fixed
  if (pergolaType === 'electricPvc') return dict.off_pergola_type_pvc
  if (pergolaType === 'electricBioclimatic') return dict.off_pergola_type_bioclimatic
  return dict.off_pergola_default
}

function colorDescription(offer: Offer, dict: PdfDict): string {
  const c = offer.color
  if (!c) return dict.off_color_dash
  if (c.type === 'ral' && c.ralCode) return `RAL ${c.ralCode}`
  if (c.type === 'wood' && c.woodName) return `${dict.off_color_woodlike} — ${c.woodName}`
  const map: Record<string, string> = {
    white: dict.off_color_white,
    black: dict.off_color_black,
    cream: dict.off_color_cream,
    ral: dict.off_color_ral,
    wood: dict.off_color_wood,
  }
  return map[c.type] ?? c.type
}

function buildPergolaLineName(offer: Offer, pergolaType: string | null | undefined, dict: PdfDict): string {
  const typeName = pergolaProductTypeLabel(pergolaType, dict)
  const parts: string[] = [typeName]
  if (offer.shadingRatio) parts.push(`${dict.off_shading} ${offer.shadingRatio}`)
  if (offer.santaf?.enabled) parts.push(dict.off_roof_santaf)
  parts.push(`${dict.off_color_prefix} ${colorDescription(offer, dict)}`)
  return parts.join(' · ')
}

function pdfQuickOfferIncludes(offer: Offer) {
  const fromExtra = resolveQuickOfferIncludesFromExtra(offer.quickOfferExtra)
  if (fromExtra) return fromExtra
  return resolveQuickOfferIncludes(offer)
}

function collectLineRows(offer: Offer, dict: PdfDict): LineRow[] {
  const rows: LineRow[] = []
  const area = offer.area > 0 ? offer.area : 1
  const inc = pdfQuickOfferIncludes(offer)
  const qExtra = offer.quickOfferExtra

  const pergolas = offer.pergolas || (offer.pergola ? [offer.pergola] : [])
  if (inc.pergola) {
    if (pergolas.length > 0) {
      const { calculatePergolaArea } = require('@/lib/calculations/pergola-area') as typeof import('@/lib/calculations/pergola-area')
      for (const pg of pergolas) {
        if (!pg?.shape) continue
        const pgArea = calculatePergolaArea(pg.shape)
        if (pgArea <= 0 || pg.pricePerSqm <= 0) continue
        rows.push({
          description: buildPergolaLineName(offer, pg.pergolaType, dict),
          unitLabel: dict.off_unit_sqm,
          quantity: Math.round(pgArea * 100) / 100,
          unitPrice: pg.pricePerSqm,
          lineTotal: Math.round(pgArea * pg.pricePerSqm * 100) / 100,
        })
      }
    } else if (offer.pergolaTotal != null && offer.pergolaTotal > 0) {
      const up = offer.pergolaTotal / area
      rows.push({
        description: buildPergolaLineName(offer, null, dict),
        unitLabel: dict.off_unit_sqm,
        quantity: Math.round(area * 100) / 100,
        unitPrice: Math.round(up * 100) / 100,
        lineTotal: offer.pergolaTotal,
      })
    }
  }

  const qr = qExtra?.quickRailings ?? offer.quickRailings
  if (inc.railings && qr) {
    const sqm = quickOfferRailingsFenceAreaSqm(qr.metersTotal, qr.heightCm)
    const up = Math.max(
      0,
      Number(
        (qr as { pricePerSqm?: number; pricePerMeter?: number }).pricePerSqm ??
          (qr as { pricePerMeter?: number }).pricePerMeter,
      ) || 0,
    )
    const lineTotal =
      offer.railingsLineTotal ??
      qExtra?.railingsLineTotal ??
      (!inc.pergola ? offer.pergolaTotal : undefined) ??
      (sqm > 0 && up > 0 ? sqm * up : 0)
    if (lineTotal > 0 && sqm > 0 && up > 0) {
      const glazingLabels: Record<string, string> = {
        aluminum_glass: dict.off_gl_al_glass,
        wet_glazing: dict.off_gl_wet,
        dry_glazing: dict.off_gl_dry,
      }
      const locLabels: Record<string, string> = {
        balcony: dict.off_loc_balcony,
        stairs: dict.off_loc_stairs,
        roof: dict.off_loc_roof,
        yard: dict.off_loc_yard,
        other: dict.off_loc_other,
      }
      rows.push({
        description: `${dict.off_rail_prefix} ${escapeHtml(qr.profileType)} · ${glazingLabels[qr.glazingSystem] ?? qr.glazingSystem} · ${dict.off_rail_loc}: ${locLabels[qr.locationType] ?? qr.locationType} · ${dict.off_color_prefix} ${escapeHtml(qr.color)}`,
        unitLabel: dict.off_unit_sqm,
        quantity: Math.round(sqm * 1000) / 1000,
        unitPrice: Math.round(up * 100) / 100,
        lineTotal,
      })
    }
  }

  const qf = qExtra?.quickFence ?? offer.quickFence
  if (inc.fence && qf) {
    const sqm = quickOfferRailingsFenceAreaSqm(qf.metersTotal, qf.heightCm)
    const up = Math.max(
      0,
      Number(
        (qf as { pricePerSqm?: number; pricePerMeter?: number }).pricePerSqm ??
          (qf as { pricePerMeter?: number }).pricePerMeter,
      ) || 0,
    )
    const lineTotal =
      offer.fenceLineTotal ??
      qExtra?.fenceLineTotal ??
      (!inc.pergola && !inc.railings ? offer.pergolaTotal : undefined) ??
      (sqm > 0 && up > 0 ? sqm * up : 0)
    const fenceLabels: Record<string, string> = {
      classic: dict.off_fence_classic,
      hitech: dict.off_fence_hitech,
      hitech_angular: dict.off_fence_hitech_ang,
    }
    if (lineTotal > 0 && sqm > 0 && up > 0) {
      rows.push({
        description: `${dict.off_fence_prefix} ${fenceLabels[qf.fenceVariant] ?? qf.fenceVariant} · ${dict.off_color_prefix} ${escapeHtml(qf.color)}`,
        unitLabel: dict.off_unit_sqm,
        quantity: Math.round(sqm * 1000) / 1000,
        unitPrice: Math.round(up * 100) / 100,
        lineTotal,
      })
    }
  }

  if (offer.santaf?.enabled && offer.santafTotal > 0) {
    const up = offer.santafTotal / area
    rows.push({
      description: offer.santaf.withStructure ? dict.off_santaf_with_struct : dict.off_santaf_bh,
      unitLabel: dict.off_unit_sqm,
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
          ? dict.off_zip_electric
          : offer.zipScreen?.type === 'manual'
            ? dict.off_zip_manual
            : dict.off_zip_screen,
      unitLabel: zm != null && zm > 0 ? dict.off_unit_rm : dict.off_unit_sqm,
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
      description: dict.off_led_light,
      unitLabel: dict.off_unit_rm,
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
      description: dict.off_drainage,
      unitLabel: dict.off_unit_rm,
      quantity: Math.round(qty * 100) / 100,
      unitPrice: ppm,
      lineTotal: offer.drainageTotal,
    })
  }

  if (offer.winterClosure?.enabled && offer.winterClosure.items?.length) {
    const typeNames: Record<string, string> = {
      fixedGlass: dict.off_wc_fixed,
      windows7000: dict.off_wc_w7000,
      windows9000: dict.off_wc_w9000,
      slidingShowcase7000: dict.off_wc_slide7000,
      slidingShowcase9000: dict.off_wc_slide9000,
      sliderGlass: dict.off_wc_slider,
      foldingGlass: dict.off_wc_folding,
    }
    const glassTypeNames: Record<string, string> = {
      tempered: dict.off_glass_tempered,
      triplex: dict.off_glass_triplex,
      insulated: dict.off_glass_insulated,
    }
    const glassTypeSuffix =
      offer.winterClosure.glassType ? ` · ${glassTypeNames[offer.winterClosure.glassType] ?? offer.winterClosure.glassType}` : ''
    for (const item of offer.winterClosure.items) {
      const name = typeNames[item.type] ?? item.type
      const note = item.notes ? ` (${escapeHtml(item.notes)})` : ''
      rows.push({
        description: `${dict.off_winter_prefix} ${name}${glassTypeSuffix}${note}`,
        unitLabel: dict.off_unit_sqm,
        quantity: Math.round(item.area * 100) / 100,
        unitPrice: item.pricePerSqm,
        lineTotal: item.area * item.pricePerSqm,
      })
    }
  }

  return rows
}

function formatSinglePergolaDimensionsHtml(pergola: Offer['pergola'], dict: PdfDict, index?: number): string {
  if (!pergola) return ''
  const typeLabel =
    pergola.pergolaType === 'fixed' ||
    pergola.pergolaType === 'electricPvc' ||
    pergola.pergolaType === 'electricBioclimatic'
      ? pergolaProductTypeLabel(pergola.pergolaType, dict)
      : null
  const headingText =
    index !== undefined
      ? `${fillTpl(dict.off_pergola_n, { n: index + 1 })}${typeLabel ? ` — ${typeLabel}` : ''}`
      : (typeLabel ?? null)
  const prefix = headingText !== null
    ? `<tr><td colspan="2" class="tech-h">${escapeHtml(headingText)}</td></tr>`
    : ''
  const m = dict.off_dim_m
  const dash = dict.off_color_dash
  const locationRow = pergola.location?.trim()
    ? `<tr><td>${dict.off_location}</td><td>${escapeHtml(pergola.location.trim())}</td></tr>`
    : ''
  const shape = pergola.shape
  if (!shape) {
    return (
      prefix +
      `<tr><td>${dict.off_dim_w_l}</td><td>${pergola.width ?? dash} × ${pergola.length ?? dash} ${m}</td></tr>` +
      locationRow
    )
  }
  switch (shape.type) {
    case 'rectangle':
      return (
        prefix +
        `<tr><td>${dict.off_shape}</td><td>${dict.off_shape_rect}</td></tr>
         <tr><td>${dict.off_dim_w_l}</td><td>${shape.width} × ${shape.length} ${m}</td></tr>` +
        locationRow
      )
    case 'L':
      return (
        prefix +
        `<tr><td>${dict.off_shape}</td><td>${dict.off_shape_l}</td></tr>
         <tr><td>${dict.off_leg1}</td><td>${shape.leg1.width} × ${shape.leg1.length} ${m}</td></tr>
         <tr><td>${dict.off_leg2}</td><td>${shape.leg2.width} × ${shape.leg2.length} ${m}</td></tr>` +
        locationRow
      )
    case 'X':
      return (
        prefix +
        `<tr><td>${dict.off_shape}</td><td>${dict.off_shape_x}</td></tr>
         <tr><td>${dict.off_center}</td><td>${shape.center.width} × ${shape.center.length} ${m}</td></tr>
         ${shape.arms
           .map(
             (a, i) =>
               `<tr><td>${fillTpl(dict.off_arm, { n: i + 1 })}</td><td>${escapeHtml(a.direction)} — ${a.width} × ${a.length} ${m}</td></tr>`,
           )
           .join('')}` +
        locationRow
      )
    case 'U':
      return (
        prefix +
        `<tr><td>${dict.off_shape}</td><td>${dict.off_shape_u}</td></tr>
         <tr><td>${dict.off_base}</td><td>${shape.base.width} × ${shape.base.length} ${m}</td></tr>
         <tr><td>${dict.off_leg_left}</td><td>${shape.leftLeg.width} × ${shape.leftLeg.length} ${m}</td></tr>
         <tr><td>${dict.off_leg_right}</td><td>${shape.rightLeg.width} × ${shape.rightLeg.length} ${m}</td></tr>` +
        locationRow
      )
    default:
      return prefix + locationRow
  }
}

function formatAllPergolasTechnicalHtml(offer: Offer, dict: PdfDict): string {
  const pk = pdfPrimaryProductKind(offer)
  const qx = offer.quickOfferExtra
  const dash = dict.off_color_dash

  if (pk === 'railings' && qx?.quickRailings) {
    const qr = qx.quickRailings
    const sqm = quickOfferRailingsFenceAreaSqm(qr.metersTotal, qr.heightCm)
    const glazingLabels: Record<string, string> = {
      aluminum_glass: dict.off_gl_al_glass,
      wet_glazing: dict.off_gl_wet,
      dry_glazing: dict.off_gl_dry,
    }
    const locLabels: Record<string, string> = {
      balcony: dict.off_loc_balcony,
      stairs: dict.off_loc_stairs,
      roof: dict.off_loc_roof,
      yard: dict.off_loc_yard,
      other: dict.off_loc_other,
    }
    return `
    <tr><td colspan="2" class="tech-h">${dict.off_rail_spec_title}</td></tr>
    <tr><td>${dict.off_len}</td><td>${escapeHtml(String(qr.metersTotal))} ${dict.off_dim_m}</td></tr>
    <tr><td>${dict.off_height}</td><td>${qr.heightCm != null ? escapeHtml(String(qr.heightCm)) : dash} ${dict.off_cm}</td></tr>
    <tr><td>${dict.off_est_area}</td><td>${sqm.toFixed(2)} ${dict.off_unit_sqm_dot}</td></tr>
    <tr><td>${dict.off_profile}</td><td>${escapeHtml(qr.profileType || dash)}</td></tr>
    <tr><td>${dict.off_color}</td><td>${escapeHtml(qr.color || dash)}</td></tr>
    <tr><td>${dict.off_location}</td><td>${escapeHtml(locLabels[qr.locationType] ?? qr.locationType)}</td></tr>
    <tr><td>${dict.off_glazing}</td><td>${escapeHtml(glazingLabels[qr.glazingSystem] ?? qr.glazingSystem)}</td></tr>
    ${qr.glassType ? `<tr><td>${dict.off_glass_detail}</td><td>${escapeHtml(qr.glassType)}</td></tr>` : ''}
    ${qr.notes ? `<tr><td>${dict.off_notes}</td><td>${escapeHtml(qr.notes)}</td></tr>` : ''}`
  }

  if (pk === 'fence' && qx?.quickFence) {
    const qf = qx.quickFence
    const sqm = quickOfferRailingsFenceAreaSqm(qf.metersTotal, qf.heightCm)
    const fenceLabels: Record<string, string> = {
      classic: dict.off_fence_short_classic,
      hitech: dict.off_fence_short_hitech,
      hitech_angular: dict.off_fence_short_hitech_ang,
    }
    return `
    <tr><td colspan="2" class="tech-h">${dict.off_fence_spec_title}</td></tr>
    <tr><td>${dict.off_len}</td><td>${escapeHtml(String(qf.metersTotal))} ${dict.off_dim_m}</td></tr>
    <tr><td>${dict.off_height}</td><td>${qf.heightCm != null ? escapeHtml(String(qf.heightCm)) : dash} ${dict.off_cm}</td></tr>
    <tr><td>${dict.off_est_area}</td><td>${sqm.toFixed(2)} ${dict.off_unit_sqm_dot}</td></tr>
    <tr><td>${dict.off_fence_type}</td><td>${escapeHtml(fenceLabels[qf.fenceVariant] ?? qf.fenceVariant)}</td></tr>
    <tr><td>${dict.off_color}</td><td>${escapeHtml(qf.color || dash)}</td></tr>
    ${qf.notes ? `<tr><td>${dict.off_notes}</td><td>${escapeHtml(qf.notes)}</td></tr>` : ''}`
  }

  const pergolas = offer.pergolas || (offer.pergola ? [offer.pergola] : [])
  if (pergolas.length === 0) return `<tr><td colspan="2">${dict.off_no_pergola_row}</td></tr>`
  return pergolas
    .map((p, i) => formatSinglePergolaDimensionsHtml(p, dict, pergolas.length > 1 ? i : undefined))
    .join('')
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

/** Customer signature: embedded digital signature when approved on the public approve page. */
function customerSignatureSectionHtml(offer: Offer, offerNo: string, docDate: string, dict: PdfDict): string {
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
    <div class="title">${dict.off_sig_digital_title}</div>
    <div class="sign-meta"><strong>${dict.off_sig_signer}:</strong> ${name}${
      phone !== '' ? ` · <strong>${dict.off_sig_phone}:</strong> ${phone}` : ''
    }</div>
    <div class="sign-meta"><strong>${dict.off_sig_approved_date}:</strong> ${escapeHtml(approvedDate)}</div>
    <div class="sign-img-wrap">
      <img src="${src}" alt="" class="sign-img" />
    </div>
    <div class="hint">${escapeHtml(fillTpl(dict.off_sig_digital_hint, { no: offerNo }))}</div>
  </div>`
  }

  return `
  <div class="sign">
    <div class="title">${dict.off_sig_title}</div>
    <div class="hint">
      ${dict.off_sig_hint_digital}
    </div>
    <div class="hint" style="margin-top:10px;">
      ${dict.off_sig_hint_manual}
    </div>
    <div class="hint" style="margin-top:16px;">
      ${escapeHtml(fillTpl(dict.off_sig_footer_line, { no: offerNo, date: docDate }))}
    </div>
  </div>`
}

/**
 * Renders a table of 3D configurator technical parameters (profiles, options) for the PDF.
 */
function configuratorParamsTechHtml(offer: Offer, dict: PdfDict): string {
  const p = offer.configuratorMeta?.params
  if (!p) return ''

  const rows: [string, string][] = []

  rows.push([dict.off_cfg_width, `${p.widthCm} ${dict.off_cm}`])
  rows.push([dict.off_cfg_depth, `${p.depthCm} ${dict.off_cm}`])
  rows.push([dict.off_cfg_height, `${p.heightCm} ${dict.off_cm}`])

  if (p.postProfileId) rows.push([dict.off_post_profile, escapeHtml(p.postProfileId)])
  if (p.beamProfileId) rows.push([dict.off_beam_profile, escapeHtml(p.beamProfileId)])
  if (p.lamellaProfileId) rows.push([dict.off_lamella_profile, escapeHtml(p.lamellaProfileId)])

  rows.push([dict.off_lamella_gap, `${p.lamellaGapCm} ${dict.off_cm}`])
  if (p.lamellaAngleDeg !== 0) rows.push([dict.off_lamella_angle, `${p.lamellaAngleDeg}°`])
  if (p.lamellaStanding) rows.push([dict.off_lamella_standing, dict.off_yes])
  if (p.lamellaAlongWidth) rows.push([dict.off_lamella_along_width, dict.off_yes])
  if (p.beamLed) rows.push([dict.off_beam_led, dict.off_yes])
  if (p.attachedToWall) rows.push([dict.off_attached_wall, dict.off_yes])
  if (p.hangingPergola) {
    rows.push([dict.off_hanging_pergola, dict.off_yes])
    rows.push([
      dict.off_hanger_count,
      String(p.hangerCount ?? 2),
    ])
    rows.push([
      dict.off_hanger_wall_rise,
      `${Math.round((p.depthCm / 3) * 10) / 10} ${dict.off_cm}`,
    ])
  }

  if (rows.length === 0) return ''

  const trs = rows.map(([label, val]) => `<tr><td>${label}</td><td>${val}</td></tr>`).join('\n    ')
  return `
  <h3 class="tech-subtitle">${dict.off_cfg_params_title}</h3>
  <table class="tech">
    ${trs}
  </table>`
}

/**
 * Technical appendix block — aligned with classic quote PDFs: "הדמיה מוצר" + schematic area on מפרט טכני.
 * @param previewImageDataUrl - Optional pre-fetched base64 data URL for the 3D preview image.
 *   Pass this to avoid Puppeteer being unable to load external URLs during PDF generation.
 */
function configuratorTechnicalAppendixHtml(offer: Offer, dict: PdfDict, previewImageDataUrl?: string | null): string {
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
      ? dict.off_viz_pergola
      : pergolas.length === 1
        ? dict.off_viz_one_pergola
        : fillTpl(dict.off_viz_n_pergolas, { n: pergolas.length })

  let body = ''
  if (img !== null) {
    body += `<div class="viz-img-wrap"><img src="${escapeAttr(img)}" alt="${escapeAttr(dict.off_viz_alt)}" /></div>`
  }
  if (link !== null) {
    body += `<div class="viz-link"><a href="${escapeHtml(link)}">${dict.off_viz_open_3d}</a></div>`
    body += `<div class="viz-note">${dict.off_viz_note}</div>`
  }

  let schematicInner = ''
  if (hasPlan) {
    schematicInner += `<div class="viz-plan-svg-wrap">${planSvg}</div>`
    schematicInner += `<p class="viz-schematic-note">${dict.off_plan_note}</p>`
  }
  if (img !== null) {
    schematicInner += `<p class="viz-schematic-note">${dict.off_viz_from_3d}</p>`
  }
  if (link !== null) {
    schematicInner += `<p class="viz-schematic-note">${dict.off_viz_rotate_hint}</p>`
  }

  const vizBlock = hasViz
    ? `
  <div class="viz-section">
    <div class="viz-section-title">${dict.off_viz_section_title}</div>
    <div class="viz-section-body">${body}</div>
  </div>`
    : ''

  return `
  <p class="viz-pergola-line">${escapeHtml(pergolaHeading)}</p>
  ${vizBlock}
  <div class="viz-section viz-schematic">
    <div class="viz-section-title">${dict.off_eng_section_title}</div>
    <div class="viz-section-body viz-schematic-body">
      ${schematicInner}
    </div>
  </div>`
}

function winterClosureTechRows(offer: Offer, dict: PdfDict): string {
  const wc = offer.winterClosure
  if (!wc?.enabled || !wc.items?.length) return ''

  const typeNames: Record<string, string> = {
    fixedGlass: dict.off_wc_fixed,
    windows7000: dict.off_wc_w7000,
    windows9000: dict.off_wc_w9000,
    slidingShowcase7000: dict.off_wc_slide7000,
    slidingShowcase9000: dict.off_wc_slide9000,
    sliderGlass: dict.off_wc_slider,
    foldingGlass: dict.off_wc_folding,
  }
  const glassTypeNames: Record<string, string> = {
    tempered: dict.off_glass_tempered,
    triplex: dict.off_glass_triplex,
    insulated: dict.off_glass_insulated,
  }

  const glassTypeLabel = wc.glassType ? glassTypeNames[wc.glassType] ?? wc.glassType : null

  let rows = `<tr><td colspan="2" class="tech-h">${dict.off_wc_title}</td></tr>`
  if (glassTypeLabel) {
    rows += `<tr><td>${dict.off_wc_glass_type}</td><td>${escapeHtml(glassTypeLabel)}</td></tr>`
  }
  for (const item of wc.items) {
    const name = typeNames[item.type] ?? item.type
    const note = item.notes ? ` · ${escapeHtml(item.notes)}` : ''
    rows += `<tr><td>${escapeHtml(name)}${note}</td><td>${(Math.round(item.area * 100) / 100).toFixed(2)} ${dict.off_unit_sqm_dot}</td></tr>`
  }
  return rows
}

/**
 * Render HTML for the offer PDF — header, line items, VAT, signature, technical appendix.
 *
 * @param omitSignatureSection - when true the signature block is omitted (public approve page).
 * @param locale - raw company/tenant locale; resolved via `resolvePdfLocale`, default Hebrew.
 */
export function renderOfferHtml(
  offer: Offer,
  previewImageDataUrl?: string | null,
  omitSignatureSection = false,
  locale?: string,
): string {
  const resolved = resolvePdfLocale(locale)
  const dict = pdfT[resolved]
  const dir = pdfHtmlDir(resolved)
  const bcp47 = pdfBcp47Locale(resolved)
  const formatPricePdf = makePriceFormatter(pdfCurrencySymbol(resolved))
  const dash = dict.off_color_dash

  const fontsCss = getHebrewFontsCss()
  const logoDataUri = getLogoDataUri()
  const notesText = offer.options?.notes?.trim() || ''
  const safeNotes = notesText ? escapeHtml(notesText) : ''

  const offerNo = formatOfferNumber(offer)
  const docDate = formatDateDdMmYyyy(offer.createdAt)
  const validUntil = formatDateDdMmYyyy(addDaysIso(offer.createdAt, 30))
  const lineRows = collectLineRows(offer, dict)
  const pdfPk = pdfPrimaryProductKind(offer)
  const areaRowLabel =
    pdfPk === 'railings' || pdfPk === 'fence' ? dict.off_area_rail_fence : dict.off_area_pergola_calc

  const linesHtml =
    lineRows.length > 0
      ? lineRows
          .map(
            (r) => `
    <tr>
      <td class="col-desc">${escapeHtml(r.description)}</td>
      <td class="col-unit">${escapeHtml(r.unitLabel)}</td>
      <td class="col-num">${r.quantity.toLocaleString(bcp47, { maximumFractionDigits: 2 })}</td>
      <td class="col-num">${formatPricePdf(r.unitPrice)}</td>
      <td class="col-num">${formatPricePdf(r.lineTotal)}</td>
    </tr>`,
          )
          .join('')
      : `<tr><td colspan="5" class="col-desc">${dict.off_no_lines}</td></tr>`

  const discountRow =
    offer.discountAmount > 0
      ? `
    <tr class="row-section">
      <td colspan="5">${dict.off_extra_products}</td>
    </tr>
    <tr>
      <td class="col-desc">${dict.off_discount}${offer.discountPercent > 0 ? ` (${offer.discountPercent}%)` : ''}</td>
      <td class="col-unit">${dict.off_unit_pc}</td>
      <td class="col-num">1</td>
      <td class="col-num">${formatPricePdf(-offer.discountAmount)}</td>
      <td class="col-num">${formatPricePdf(-offer.discountAmount)}</td>
    </tr>`
      : ''

  const vatPct = offer.vatPercent ?? 18
  const vatLineLabel = fillTpl(dict.off_vat_line, { p: String(vatPct) })
  const roofCell =
    offer.santaf?.enabled
      ? dict.off_roof_cell_santaf
      : offer.roof?.type === 'triplexGlass'
        ? dict.off_roof_triplex
        : dash
  const warrantyCovers = (offer.warranty?.covers ?? []).join(', ')
  const termsTail = `${fillTpl(dict.off_valid_30, { y: String(offer.warranty?.years ?? 7) })}${warrantyCovers ? `: ${warrantyCovers}` : ''}`
  const termsBody = OFFER_TERMS_BODIES[resolved]

  return `
<!DOCTYPE html>
<html dir="${dir}" lang="${bcp47}">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(fillTpl(dict.off_html_title, { no: offerNo }))}</title>
  <style>
    ${fontsCss}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Noto Sans Hebrew', 'Segoe UI', Tahoma, sans-serif;
      direction: ${dir};
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
      text-align: end;
      direction: ${dir};
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
    .col-desc { width: 38%; text-align: start; }
    .col-unit { width: 10%; text-align: center; }
    .col-num { width: 14%; text-align: left; direction: ltr; unicode-bidi: embed; }
    tr.row-section td {
      font-weight: 700;
      background: #fafafa;
    }
    table.summary {
      width: 100%;
      max-width: 320px;
      margin-block: 0 16px;
      margin-inline-start: auto;
      margin-inline-end: 0;
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
    .terms-body {
      white-space: pre-wrap;
      font-size: 8.5px;
      line-height: 1.38;
      margin-top: 4px;
    }
    .terms-tail { margin-top: 10px; font-size: 8.5px; }
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
        <div class="sub">${dict.off_brand_sub}</div>
        <div class="sub">${dict.off_brand_phone_line}</div>
      </div>
    </div>
    <div class="meta">
      <div>${dict.off_vat_id}: <strong>320807068</strong></div>
      <div class="big">${escapeHtml(fillTpl(dict.off_quote_big, { no: offerNo }))}</div>
      <div><strong>${dict.off_date}:</strong> ${docDate}</div>
      <div><strong>${dict.off_valid_until}:</strong> ${validUntil}</div>
    </div>
  </div>

  <div class="customer">
    <div class="label">${dict.off_to_customer}</div>
    <div class="name">${escapeHtml(offer.customerName)}</div>
    ${
      offer.customerPhone
        ? `<div style="margin-top:4px;font-size:11px;">${dict.off_phone_lbl}: ${escapeHtml(offer.customerPhone)}${
            offer.customerCity ? ` · ${escapeHtml(offer.customerCity)}` : ''
          }</div>`
        : ''
    }
  </div>

  ${safeNotes ? `<div class="notes-box"><strong>${dict.off_notes_title}:</strong><br/>${safeNotes}</div>` : ''}

  <table class="lines">
    <thead>
      <tr>
        <th>${dict.off_th_desc}</th>
        <th>${dict.off_th_measure}</th>
        <th>${dict.off_th_qty}</th>
        <th>${dict.off_th_price}</th>
        <th>${dict.off_th_total}</th>
      </tr>
    </thead>
    <tbody>
      ${linesHtml}
      ${discountRow}
    </tbody>
  </table>

  <table class="summary">
    <tr><td>${dict.off_vat_before}</td><td>${formatPricePdf(offer.totalBeforeVat)}</td></tr>
    <tr><td>${escapeHtml(vatLineLabel)}</td><td>${formatPricePdf(offer.vatAmount)}</td></tr>
    <tr><td>${dict.off_vat_incl}</td><td>${formatPricePdf(offer.priceWithVat)}</td></tr>
    ${
      offer.discountAmount > 0
        ? `<tr><td>${dict.off_after_discount}</td><td>${formatPricePdf(offer.finalPrice)}</td></tr>`
        : ''
    }
  </table>

  ${omitSignatureSection ? '' : customerSignatureSectionHtml(offer, offerNo, docDate, dict)}

  <div class="page-foot">
    <span>${dict.off_foot_web}</span>
    <span>${dict.off_page_1_of_2}</span>
  </div>

  <div class="page-break"></div>

  <h2 class="tech-title">${dict.off_tech_title}</h2>
  <table class="tech">
    <tr><td>${dict.off_finish_color}</td><td>${escapeHtml(colorDescription(offer, dict))}</td></tr>
    <tr><td>${dict.off_roof}</td><td>${escapeHtml(roofCell)}</td></tr>
    <tr><td>${dict.off_shade_ratio}</td><td>${offer.shadingRatio ? escapeHtml(offer.shadingRatio) : dash}</td></tr>
    <tr><td>${dict.off_finish_type}</td><td>${offer.finishType ? escapeHtml(offer.finishType) : dash} ${offer.finishValue ? `· ${escapeHtml(offer.finishValue)}` : ''}</td></tr>
    <tr><td>${escapeHtml(areaRowLabel)}</td><td>${offer.area.toFixed(2)} ${dict.off_unit_sqm_dot}</td></tr>
    ${winterClosureTechRows(offer, dict)}
  </table>

  <table class="tech">
    ${formatAllPergolasTechnicalHtml(offer, dict)}
  </table>

  ${pdfPk === 'pergola' ? configuratorParamsTechHtml(offer, dict) : ''}

  ${configuratorTechnicalAppendixHtml(offer, dict, previewImageDataUrl)}

  <div class="terms">
    <div class="terms-body">${escapeHtml(termsBody)}</div>
    <div class="terms-tail">${escapeHtml(termsTail)}</div>
  </div>

  <div class="page-foot">
    <span>${escapeHtml(fillTpl(dict.off_quote_big, { no: offerNo }))}</span>
    <span>${dict.off_page_2_of_2}</span>
  </div>
</body>
</html>
`.trim()
}
