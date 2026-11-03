import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CutPiece, ProfileDimensions } from '@pashkovsky/pergola-core'
import { buildProfileBundlePlans } from '../order-sheet'
import { profilePhotoMatch, renderCuttingPages, renderOrderPages } from '../cut-map'
import { inlineProfilePhotoDataUris } from '../../pdf/inline-profile-photos'
import { renderSheetHtmlToPdfBuffer } from '../../pdf/render-sheet-pdf'

// R242 uses the dim-labeled schematic (r242.jpg is 142×100, wrong vs 142×70).
const PHOTO_IDS = ['f10040', 'f7020', 'f8080', 'PA3022', 'F100100', 'F4060'] as const

const orderLabels = {
  title: 'הזמנה',
  wall: 'דופן',
  stock: 'אורך מוט',
  bars: 'מוטות',
  meters: 'מטרים',
  weight: 'משקל',
  weightMissing: 'משקל לא הוגדר',
  profile: 'פרופיל',
  total: 'סה״כ',
  noImage: 'אין תמונה',
  noData: 'אין נתונים',
  schematic: 'חתך סכמטי',
  sharedDrawing: 'שרטוט F4060',
  kerfNote: 'מרוח חיתוך 5 מ״מ',
}

function piece(profileId: string, id: string, miter = 0): CutPiece {
  return {
    id,
    role: 'beam',
    profileId,
    lengthAxisMm: 2000,
    lengthLongMm: 2000,
    lengthShortMm: 2000,
    cutMiterStartDeg: miter,
    cutBevelStartDeg: 0,
    cutHandStart: 'straight',
    cutMiterEndDeg: 0,
    cutBevelEndDeg: 0,
    cutHandEnd: 'straight',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    color: '#9aa0a6',
  }
}

function profile(): ProfileDimensions {
  return { widthMm: 40, heightMm: 100, wallThicknessMm: 1.8, weightKgPerMeter: 1.2, availableStockLengthsMm: [6000] }
}

const profiles: Map<string, ProfileDimensions> = new Map([
  ...PHOTO_IDS.map((id) => [id, profile()] as const),
  ['missing-x', { widthMm: 80, heightMm: 40, wallThicknessMm: 2, availableStockLengthsMm: [6000] }],
])

function photoPath(id: string): string {
  const file = profilePhotoMatch(id).file
  if (!file) throw new Error(`no photo for ${id}`)
  return path.join(process.cwd(), 'apps/crm/public/profile-photo-check/photos', file)
}

describe('button sheet html', () => {
  const plans = buildProfileBundlePlans(
    [
      ...PHOTO_IDS.map((id, index) => piece(id, `p-${index}`, index === 0 ? 45 : 0)),
      piece('missing-x', 'missing'),
    ],
    profiles,
  )
  const order = renderOrderPages({
    plans,
    profiles,
    labels: orderLabels,
    rtl: true,
    photoSrc: (file) => `/profile-photo-check/photos/${file}`,
  })
  const cutting = renderCuttingPages({
    plans,
    profiles,
    rtl: true,
    labels: {
      title: 'חיתוך',
      rest: 'יתרה',
      wall: 'דופן',
      stock: 'אורך מוט',
      bars: 'מוטות',
      weight: 'משקל',
      weightMissing: 'משקל לא הוגדר',
      noImage: 'אין תמונה',
      noData: 'אין נתונים',
      sharedDrawing: 'שרטוט F4060',
      kerf: 'מרוח',
      schematic: 'חתך סכמטי',
      howTitle: 'איך לקרוא',
      howAngle: 'זווית',
      howBeam: 'קורה',
      howPart: 'חלק',
      howColor: 'צבע',
      lamellas: 'למלות',
      beamMark: (n: number) => `ק${n}`,
    },
    photoSrc: (file) => `/profile-photo-check/photos/${file}`,
  })
  const html = `${order.html}${cutting.html}`

  it('rejects the gray swatch and the old cutting-map markup', () => {
    expect(html).not.toContain('#9aa0a6')
    expect(html).not.toContain('legacy-cut-rows')
    expect(html).not.toContain('data-pdf-row')
    expect(html).toContain('class="bar-row"')
    // missing-x has section dims → schematic with labels, not “no photo”.
    expect(html).toContain('class="schematic"')
    expect(html).toContain('>80</text>')
    expect(html).toContain('>40</text>')
    expect(html).not.toContain('אין תמונה')
    expect(html).toContain('fill="#b91c1c"')
    expect(html).toContain('font-size="18"')
  })

  it('embeds a local section drawing for every listed profile', () => {
    const inlined = inlineProfilePhotoDataUris(html)
    for (const id of PHOTO_IDS) {
      const file = profilePhotoMatch(id).file
      expect(file, id).toBeTruthy()
      const encoded = fs.readFileSync(photoPath(id)).toString('base64')
      expect(inlined, id).toContain(`data:image/jpeg;base64,${encoded.slice(0, 80)}`)
    }
    expect(inlined).not.toContain('#9aa0a6')
  })

  it('R242 has no wrong 142×100 photo — schematic only', () => {
    expect(profilePhotoMatch('R242')).toEqual({ profileId: 'R242', file: null, confidence: 'none' })
  })

  it('prints those drawings into the PDF', async () => {
    const pdf = await renderSheetHtmlToPdfBuffer(`<!DOCTYPE html><html><body>${order.html}</body></html>`)
    const text = pdf.toString('latin1')
    const images = text.match(/\/Subtype\s*\/Image/g) ?? []
    expect(images.length).toBeGreaterThanOrEqual(PHOTO_IDS.length)
  }, 90000)

  it('keeps the production and order buttons off the old sheet components', () => {
    const modal = fs.readFileSync(
      path.join(process.cwd(), 'apps/crm/components/offers/PlanDrawingSheetsModal.tsx'),
      'utf8',
    )
    expect(modal).not.toContain('<CuttingSheet')
    expect(modal).not.toContain('<OrderSheet')
    expect(modal).not.toContain('data-pdf-flow')
    expect(modal).toContain('renderCuttingPages')
    expect(modal).toContain('renderOrderPages')
  })
})
