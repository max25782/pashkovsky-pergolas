import {
  calculateOffer,
  parseDiscountPercent,
  pergolaUnitPriceIsBillable,
  quickOfferRailingsFenceAreaSqm,
  resolveQuickFences,
} from '@/lib/offer-calculator'
import { lineAmountFromBillableArea, pergolaAreaSqm } from '@/lib/pergolas/pergola-area-sqm'
import { resolveQuickOfferIncludes } from '@/lib/quick-offer-includes'
import { gateUnitTotal } from '@/types/offer'
import type {
  Offer,
  OfferCalculation,
  OfferDraft,
  OfferPricingLine,
  OfferPricingSnapshot,
  Pergola,
  QuickOfferExtraPersisted,
} from '@/types/offer'
import { OFFER_PRICING_SNAPSHOT_VERSION } from '@/types/offer'

function roundQty(n: number): number {
  return Math.round(n * 100) / 100
}

function pergolaList(draft: OfferDraft): Pergola[] {
  return draft.pergolas || (draft.pergola ? [draft.pergola] : [])
}

function hasPerPergolaAddons(pergolas: Pergola[]): boolean {
  return pergolas.some(
    (p) => p !== undefined && (p.santaf !== undefined || p.drainage !== undefined || p.lighting !== undefined),
  )
}

/**
 * Price lines that sum to `calculation.totalBeforeVat`.
 * A pergola whose ₪/m² is empty or 0 contributes area to add-ons and no price line.
 */
export function buildOfferPricingLines(draft: OfferDraft, calculation: OfferCalculation): OfferPricingLine[] {
  const inc = resolveQuickOfferIncludes(draft)
  const pergolas = pergolaList(draft)
  const lines: OfferPricingLine[] = []
  const perAddon = hasPerPergolaAddons(pergolas)

  if (inc.pergola) {
    for (const pergola of pergolas) {
      if (!pergola) continue
      const area = pergolaAreaSqm(pergola)
      if (area === null || area <= 0 || !pergolaUnitPriceIsBillable(pergola.pricePerSqm)) continue
      const unit = Number(pergola.pricePerSqm)
      lines.push({
        kind: 'pergola',
        quantity: area,
        unitPrice: unit,
        lineTotal: lineAmountFromBillableArea(area, unit),
        unit: 'sqm',
      })
    }
  }

  if (inc.railings && draft.quickRailings && (calculation.railingsLineTotal ?? 0) > 0) {
    const qr = draft.quickRailings
    const sqm = quickOfferRailingsFenceAreaSqm(qr.metersTotal, qr.heightCm)
    lines.push({
      kind: 'railings',
      quantity: sqm,
      unitPrice: sqm > 0 ? (calculation.railingsLineTotal ?? 0) / sqm : 0,
      lineTotal: calculation.railingsLineTotal ?? 0,
      unit: 'sqm',
    })
  }

  if (inc.fence) {
    const fences = resolveQuickFences(draft)
    fences.forEach((qf, idx) => {
      const lineTotal = calculation.fenceLineTotals?.[idx] ?? 0
      if (lineTotal <= 0) return
      const sqm = quickOfferRailingsFenceAreaSqm(qf.metersTotal, qf.heightCm)
      lines.push({
        kind: 'fence',
        quantity: sqm,
        unitPrice: sqm > 0 ? lineTotal / sqm : 0,
        lineTotal,
        unit: 'sqm',
      })
      ;(qf.gates ?? []).forEach((gate, gateIdx) => {
        const gateTotal =
          calculation.fenceGateLineTotals?.[idx]?.[gateIdx] ?? Math.round(gateUnitTotal(gate) * 100) / 100
        if (gateTotal <= 0) return
        lines.push({
          kind: 'gate',
          quantity: 1,
          unitPrice: gateTotal,
          lineTotal: gateTotal,
          unit: 'pc',
        })
      })
    })
  }

  if (perAddon) {
    for (const pergola of pergolas) {
      if (!pergola) continue
      const area = pergolaAreaSqm(pergola) ?? 0
      const ps = pergola.santaf
      if (ps?.enabled && area > 0) {
        const lineTotal = Math.round(area * ps.pricePerSqm * 100) / 100
        if (lineTotal > 0) {
          lines.push({
            kind: 'santaf',
            quantity: roundQty(area),
            unitPrice: ps.pricePerSqm,
            lineTotal,
            unit: 'sqm',
          })
        }
      }
      const pd = pergola.drainage
      if (pd?.enabled && (pd.runningMeters ?? 0) > 0) {
        const m = pd.runningMeters ?? 0
        const lineTotal = Math.round(m * pd.pricePerMeter * 100) / 100
        if (lineTotal > 0) {
          lines.push({
            kind: 'drainage',
            quantity: roundQty(m),
            unitPrice: pd.pricePerMeter,
            lineTotal,
            unit: 'rm',
          })
        }
      }
      const pl = pergola.lighting
      if (pl?.enabled && (pl.runningMeters ?? 0) > 0) {
        const m = pl.runningMeters ?? 0
        const lineTotal = Math.round(m * pl.pricePerMeter * 100) / 100
        if (lineTotal > 0) {
          lines.push({
            kind: 'lighting',
            quantity: roundQty(m),
            unitPrice: pl.pricePerMeter,
            lineTotal,
            unit: 'rm',
          })
        }
      }
    }
  } else if (calculation.santafTotal > 0) {
    const rate = draft.santaf.withStructure
      ? draft.santaf.pricePerSqmWithStructure
      : draft.santaf.pricePerSqmBasic
    const qty = rate > 0 ? roundQty(calculation.santafTotal / rate) : 0
    lines.push({
      kind: draft.santaf.withStructure ? 'santaf-structure' : 'santaf',
      quantity: qty,
      unitPrice: rate,
      lineTotal: calculation.santafTotal,
      unit: 'sqm',
    })
  }

  if (calculation.zipScreenTotal > 0) {
    const meters = draft.zipScreen.runningMeters
    const qty = meters != null && meters > 0 ? meters : 0
    lines.push({
      kind: 'zip',
      quantity: qty > 0 ? roundQty(qty) : 1,
      unitPrice: qty > 0 ? calculation.zipScreenTotal / qty : calculation.zipScreenTotal,
      lineTotal: calculation.zipScreenTotal,
      unit: qty > 0 ? 'rm' : 'sqm',
    })
  }

  if (!perAddon && calculation.lightingTotal > 0) {
    const meters = draft.lighting.runningMeters ?? 0
    lines.push({
      kind: 'lighting',
      quantity: meters > 0 ? roundQty(meters) : 1,
      unitPrice: meters > 0 ? draft.lighting.pricePerMeter : calculation.lightingTotal,
      lineTotal: calculation.lightingTotal,
      unit: 'rm',
    })
  }

  if (!perAddon && calculation.drainageTotal > 0) {
    const meters = draft.drainage.runningMeters ?? 0
    lines.push({
      kind: 'drainage',
      quantity: meters > 0 ? roundQty(meters) : 1,
      unitPrice: meters > 0 ? draft.drainage.pricePerMeter : calculation.drainageTotal,
      lineTotal: calculation.drainageTotal,
      unit: 'rm',
    })
  }

  if (draft.winterClosure.enabled) {
    for (const item of draft.winterClosure.items) {
      const lineTotal = item.area * item.pricePerSqm
      if (lineTotal <= 0) continue
      lines.push({
        kind: 'winter',
        quantity: roundQty(item.area),
        unitPrice: item.pricePerSqm,
        lineTotal,
        unit: 'sqm',
      })
    }
  }

  return lines
}

/** Screen, save, PDF, and the public page all start from this object. */
export function buildOfferPricingSnapshot(
  draft: OfferDraft,
  calculation: OfferCalculation = calculateOffer(draft),
): OfferPricingSnapshot {
  return {
    version: OFFER_PRICING_SNAPSHOT_VERSION,
    lines: buildOfferPricingLines(draft, calculation),
    discountPercent: parseDiscountPercent(draft.discountPercent),
    totals: calculation,
  }
}

export function isOfferPricingSnapshot(raw: unknown): raw is OfferPricingSnapshot {
  if (!raw || typeof raw !== 'object') return false
  const o = raw as Record<string, unknown>
  return o.version === OFFER_PRICING_SNAPSHOT_VERSION && Array.isArray(o.lines) && o.totals != null
}

/**
 * Old offers are those without `quick_offer_extra.pricingSnapshot` version 1.
 * Callers then keep the previous plan recalculation (including the 750 default
 * when `pricePerSqm` was never stored).
 */
export function readOfferPricingSnapshot(
  offer: { quickOfferExtra?: QuickOfferExtraPersisted | null },
): OfferPricingSnapshot | null {
  const raw = offer.quickOfferExtra?.pricingSnapshot
  return isOfferPricingSnapshot(raw) ? raw : null
}

export function offerPricedFromSnapshot(
  offer: { quickOfferExtra?: QuickOfferExtraPersisted | null },
): boolean {
  return readOfferPricingSnapshot(offer) !== null
}

/** Printed percent. 27.5 stays "27.5"; 27 stays "27". */
export function formatEnteredPercent(percent: number): string {
  if (!Number.isFinite(percent)) return '0'
  const scaled = Math.round(percent * 100) / 100
  return String(scaled)
}

function ils(amount: number): string {
  const negative = amount < 0
  const abs = Math.abs(amount)
  const [whole, frac] = abs.toFixed(2).split('.')
  const formatted = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${frac}`
  return negative ? `-₪${formatted}` : `₪${formatted}`
}

const LINE_LABEL_HE: Record<OfferPricingLine['kind'], string> = {
  pergola: 'פרגולה',
  santaf: 'סנטף BH',
  'santaf-structure': 'סנטף BH כולל קונסטרוקציה',
  zip: 'מסך ZIP',
  lighting: 'תאורה',
  drainage: 'ניקוז',
  winter: 'סגירת חורף',
  railings: 'מעקה',
  fence: 'גדר',
  gate: 'שער',
}

export function snapshotShareLines(
  snapshot: OfferPricingSnapshot,
): { label: string; amount: number }[] {
  return snapshot.lines.map((line) => ({
    label: LINE_LABEL_HE[line.kind],
    amount: line.lineTotal,
  }))
}

/** WhatsApp / email body from the frozen snapshot, not from a fresh plan calculation. */
export function customerOfferMessage(input: {
  customerName: string
  offerUrl: string
  snapshot: OfferPricingSnapshot
}): string {
  const { snapshot } = input
  const lineText = snapshot.lines
    .map((line) => `${LINE_LABEL_HE[line.kind]}: ${ils(line.lineTotal)}`)
    .join('\n')
  const discount =
    snapshot.discountPercent > 0
      ? `הנחה: ${formatEnteredPercent(snapshot.discountPercent)}% (${ils(-snapshot.totals.discountAmount)})\n`
      : ''
  return (
    `שלום ${input.customerName},\n\n` +
    `הצעת המחיר שלך מוכנה!\n\n` +
    `${lineText}\n` +
    discount +
    `סה״כ: ${ils(snapshot.totals.finalPrice)}\n\n` +
    `לצפייה בהצעה:\n${input.offerUrl}\n\n` +
    `בברכה,\nPashkovsky Group`
  )
}

export function applySnapshotToOffer(offer: Offer): Offer {
  const snapshot = readOfferPricingSnapshot(offer)
  if (!snapshot) return offer
  const totals = snapshot.totals
  return {
    ...offer,
    area: totals.area,
    pergolaTotal: totals.pergolaTotal,
    railingsLineTotal: totals.railingsLineTotal,
    fenceLineTotal: totals.fenceLineTotal,
    fenceLineTotals: totals.fenceLineTotals,
    fenceGateLineTotals: totals.fenceGateLineTotals,
    fenceGateTotal: totals.fenceGateTotal,
    santafTotal: totals.santafTotal,
    zipScreenTotal: totals.zipScreenTotal,
    lightingTotal: totals.lightingTotal,
    drainageTotal: totals.drainageTotal,
    winterClosureTotal: totals.winterClosureTotal,
    totalBeforeVat: totals.totalBeforeVat,
    vatPercent: totals.vatPercent,
    vatAmount: totals.vatAmount,
    priceWithVat: totals.priceWithVat,
    discountPercent: snapshot.discountPercent,
    discountAmount: totals.discountAmount,
    finalPrice: totals.finalPrice,
    pricing: {
      ...offer.pricing,
      pergolaTotal: totals.pergolaTotal,
      santafTotal: totals.santafTotal,
      zipScreenTotal: totals.zipScreenTotal,
      lightingTotal: totals.lightingTotal,
      drainageTotal: totals.drainageTotal,
      winterClosureTotal: totals.winterClosureTotal,
      totalBeforeVat: totals.totalBeforeVat,
      vatPercent: totals.vatPercent,
      vatAmount: totals.vatAmount,
      priceWithVat: totals.priceWithVat,
      discountPercent: snapshot.discountPercent,
      discountAmount: totals.discountAmount,
      finalPrice: totals.finalPrice,
    },
  }
}
