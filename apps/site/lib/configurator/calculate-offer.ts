import type { OfferDraftCalc, OfferCalculation } from './offer-calc-types'
import { calculatePergolaArea } from './pergola-area'
import { calculateSuntufSheets, calculateSuntufPriceByArea } from './suntuf-sheets'

export function calculateOffer(draft: OfferDraftCalc): OfferCalculation {
  const pergolas = draft.pergolas || (draft.pergola ? [draft.pergola] : [])

  let pergolaArea = 0
  let pergolaTotal = 0

  for (const pergola of pergolas) {
    if (pergola?.shape) {
      const singleArea = calculatePergolaArea(pergola.shape)
      pergolaArea += singleArea
      pergolaTotal += singleArea * pergola.pricePerSqm
    }
  }

  let santafArea = 0
  if (draft.santaf.enabled) {
    if (pergolaArea > 0) santafArea = pergolaArea
    else if (draft.santaf.width && draft.santaf.length) {
      santafArea = draft.santaf.width * draft.santaf.length
    }
  }

  const area = pergolaArea || santafArea
  const pergolaTotalFinal = pergolas.length > 0 ? pergolaTotal : undefined

  let santafTotal = 0
  if (draft.santaf.enabled && santafArea > 0) {
    const santafPrice = draft.santaf.withStructure
      ? draft.santaf.pricePerSqmWithStructure
      : draft.santaf.pricePerSqmBasic

    let suntufWidth = 0
    let suntufLength = 0

    if (pergolas.length > 0 && pergolas[0]?.shape) {
      const firstPergola = pergolas[0]
      if (firstPergola.shape.type === 'rectangle') {
        suntufWidth = firstPergola.shape.width
        suntufLength = firstPergola.shape.length
      } else {
        const sideLength = Math.sqrt(santafArea)
        suntufWidth = sideLength
        suntufLength = sideLength
      }
    } else if (draft.santaf.width && draft.santaf.length) {
      suntufWidth = draft.santaf.width
      suntufLength = draft.santaf.length
    }

    if (suntufWidth > 0 && suntufLength > 0) {
      const overlapType = draft.santaf.overlapType || 'double'
      const suntufCalc = calculateSuntufSheets(suntufWidth, suntufLength, overlapType)
      santafTotal = calculateSuntufPriceByArea(suntufCalc.suntufMaterialArea, santafPrice)
    } else {
      santafTotal = santafArea * santafPrice
    }
  }

  let zipScreenTotal = 0
  if (draft.zipScreen.enabled && draft.zipScreen.type) {
    const zipPrice =
      draft.zipScreen.type === 'electric'
        ? draft.zipScreen.pricePerSqmElectric
        : draft.zipScreen.pricePerSqmManual
    const meters = draft.zipScreen.runningMeters || area
    zipScreenTotal = meters * zipPrice
  }

  let lightingTotal = 0
  if (draft.lighting.enabled) {
    const meters = draft.lighting.runningMeters || 0
    lightingTotal = meters * draft.lighting.pricePerMeter
  }

  let drainageTotal = 0
  if (draft.drainage.enabled) {
    const meters = draft.drainage.runningMeters || 0
    drainageTotal = meters * draft.drainage.pricePerMeter
  }

  let winterClosureTotal = 0
  if (draft.winterClosure.enabled && draft.winterClosure.items.length > 0) {
    winterClosureTotal = draft.winterClosure.items.reduce(
      (sum, item) => sum + item.area * item.pricePerSqm,
      0
    )
  }

  const totalBeforeVat =
    (pergolaTotalFinal || 0) +
    santafTotal +
    zipScreenTotal +
    lightingTotal +
    drainageTotal +
    winterClosureTotal

  const vatAmount = totalBeforeVat * 0.18
  const priceWithVat = totalBeforeVat + vatAmount
  const discountPercent = draft.discountPercent || 0
  const discountAmount = (priceWithVat * discountPercent) / 100
  const finalPrice = priceWithVat - discountAmount

  return {
    area,
    pergolaTotal: pergolaTotalFinal,
    santafTotal,
    zipScreenTotal,
    lightingTotal,
    drainageTotal,
    winterClosureTotal,
    totalBeforeVat,
    vatPercent: 18,
    vatAmount,
    priceWithVat,
    discountPercent,
    discountAmount,
    finalPrice,
  }
}
