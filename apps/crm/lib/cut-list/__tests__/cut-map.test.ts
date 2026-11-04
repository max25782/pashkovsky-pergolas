import { describe, expect, it } from 'vitest'
import type { CutPiece, ProfileDimensions } from '@pashkovsky/pergola-core'
import { buildProfileBundlePlans } from '../order-sheet'
import { profilePhotoMatch, renderCuttingPages, renderOrderPages } from '../cut-map'

function piece(overrides: Partial<CutPiece> & { id: string; lengthAxisMm: number }): CutPiece {
  return {
    role: 'beam',
    profileId: 'f10040',
    lengthLongMm: overrides.lengthAxisMm,
    lengthShortMm: overrides.lengthAxisMm,
    cutMiterStartDeg: 0,
    cutBevelStartDeg: 0,
    cutHandStart: 'straight',
    cutMiterEndDeg: 0,
    cutBevelEndDeg: 0,
    cutHandEnd: 'straight',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    color: '#2B2B2B',
    ...overrides,
  }
}

const profiles: Map<string, ProfileDimensions> = new Map([
  ['f10040', { widthMm: 40, heightMm: 100, wallThicknessMm: 1.8, weightKgPerMeter: 1.372, availableStockLengthsMm: [7000] }],
  ['f7020', { widthMm: 70, heightMm: 20, wallThicknessMm: 0.8, weightKgPerMeter: 0.411, availableStockLengthsMm: [6000] }],
  ['PA3022', { widthMm: 40, heightMm: 60, availableStockLengthsMm: [6000] }],
])

const labels = {
  title: 'Порезка',
  rest: 'остаток',
  wall: 'стенка',
  stock: 'хлыст',
  bars: 'хлыстов',
  weight: 'вес',
  weightMissing: 'вес не задан',
  noImage: 'нет изображения',
  noData: 'нет данных',
  sharedDrawing: 'чертёж F4060',
  kerf: 'пропил',
  schematic: 'сечение схематично',
  howTitle: 'Как читать',
  howAngle: 'Красная цифра у торца — угол среза от прямого реза.',
  howBeam: 'Подпись под деталью — номер балки на плане.',
  howPart: '1/2 — часть одной балки со стыком.',
  howColor: 'Цвет детали — тип секции или балки.',
  lamellas: 'ламели',
  beamMark: (n: number) => `Б${n}`,
}

describe('cutting map', () => {
  const pieces: CutPiece[] = [
    piece({ id: 'beam-0', lengthAxisMm: 4000, lengthLongMm: 4000, cutMiterStartDeg: 45, cutMiterEndDeg: 0, cutHandStart: 'L' }),
    ...Array.from({ length: 8 }, (_, index) => piece({
      id: `lam-${index}`,
      role: 'lamella',
      profileId: 'f7020',
      lengthAxisMm: 1239,
      lengthLongMm: 1239,
    })),
    piece({ id: 'lam-long', role: 'lamella', profileId: 'f7020', lengthAxisMm: 1888, lengthLongMm: 1888 }),
  ]
  const plans = buildProfileBundlePlans(pieces, profiles)
  const drawn = renderCuttingPages({ plans, profiles, labels, rtl: true })

  it('draws scaled bars, groups identical ones, and states the legend once', () => {
    expect(drawn.html).toContain('×')
    expect(drawn.html).toContain('4000')
    expect(drawn.html).toContain('45°')
    expect(drawn.html).not.toMatch(/90°/)
    expect(drawn.html).not.toContain('длинная точка')
    expect(drawn.html).not.toContain('long point')
    expect(drawn.html).toContain('остаток')
    expect(drawn.html).toContain('#86efac')
    expect(drawn.html.match(/Как читать/g)).toHaveLength(1)
    expect(drawn.html).toContain('<bdi dir="ltr">')
    expect(drawn.html).toContain('f7020')
  })

  it('matches a photo only when the file name is that profile id', () => {
    expect(profilePhotoMatch('f10040')).toEqual({ profileId: 'f10040', file: 'f10040.jpg', confidence: 'high' })
    expect(profilePhotoMatch('f7020')).toEqual({ profileId: 'f7020', file: 'f7020.jpg', confidence: 'high' })
    expect(profilePhotoMatch('PA3022').confidence).toBe('high')
    expect(profilePhotoMatch('pa1162')).toEqual({ profileId: 'pa1162', file: 'pa1162.jpg', confidence: 'high' })
    // Wrong catalog photo (142×100); header uses the drawn double-T with 142×70 labels.
    expect(profilePhotoMatch('R242')).toEqual({ profileId: 'R242', file: null, confidence: 'none' })
    expect(drawn.photos.find((photo) => photo.profileId === 'f10040')?.confidence).toBe('high')
    expect(drawn.html).toContain('сечение схематично')
  })

  it('R242 cut sheet draws double-T 142×70 without «схематично»', () => {
    const r242Plans = buildProfileBundlePlans([
      piece({
        id: 'beam-0',
        profileId: 'R242',
        lengthAxisMm: 4000,
        lengthLongMm: 4000,
        cutMiterStartDeg: 45,
        cutMiterEndDeg: 0,
        cutHandStart: 'L',
      }),
    ], new Map([['R242', { widthMm: 70, heightMm: 142, wallThicknessMm: 1.6, weightKgPerMeter: 2.5, availableStockLengthsMm: [6500] }]]))
    const html = renderCuttingPages({
      plans: r242Plans,
      profiles: new Map([['R242', { widthMm: 70, heightMm: 142, wallThicknessMm: 1.6, weightKgPerMeter: 2.5, availableStockLengthsMm: [6500] }]]),
      labels,
      rtl: false,
    }).html
    expect(html).toContain('>142</text>')
    expect(html).toContain('>70</text>')
    expect(html).not.toContain('сечение схематично')
    expect(html).toContain('aria-label="WT R242 142×70"')
  })

  it('uses the local F4060 drawing for PA1296 and leaves a profile without an image or a weight as such', () => {
    const extraProfiles = new Map(profiles)
    extraProfiles.set('PA1296', { widthMm: 40, heightMm: 60, wallThicknessMm: 2, weightKgPerMeter: 1.098, availableStockLengthsMm: [6000] })
    extraProfiles.set('no-weight-bar', { widthMm: 120, heightMm: 50, availableStockLengthsMm: [6000] })
    const extraPlans = buildProfileBundlePlans([
      piece({ id: 'shelf', role: 'purlin', profileId: 'PA1296', lengthAxisMm: 3000, lengthLongMm: 3000 }),
      piece({ id: 'wall-bar', profileId: 'no-weight-bar', lengthAxisMm: 2000, lengthLongMm: 2000 }),
    ], extraProfiles)
    const html = renderCuttingPages({
      plans: extraPlans,
      profiles: extraProfiles,
      labels,
      rtl: true,
      photoSrc: (file) => `/photos/${file}`,
    }).html
    expect(html).toContain('чертёж F4060')
    expect(html).toContain('/photos/pa1296.jpg')
    expect(html).toContain('no-weight-bar')
    // Known section size → dim-labeled schematic, not the “no image” caption.
    expect(html).toContain('сечение схематично')
    expect(html).toContain('>120</text>')
    expect(html).toContain('>50</text>')
    expect(html).not.toContain('нет изображения')
    expect(html).toContain('вес не задан')
    expect(html).not.toContain('нет данных')
    expect(html).not.toContain('no-weight-bar.jpg')
    expect(html).not.toContain('amazonaws')
  })

  it('shows the F12040 section drawing for pa1162 in the cutting header and the order card', () => {
    const extraProfiles = new Map(profiles)
    extraProfiles.set('pa1162', {
      widthMm: 40,
      heightMm: 120,
      wallThicknessMm: 1.8,
      weightKgPerMeter: 1.632,
      availableStockLengthsMm: [6000, 6500, 7000, 5000, 4000],
    })
    const plans = buildProfileBundlePlans([
      piece({ id: 'shelf', role: 'purlin', profileId: 'pa1162', lengthAxisMm: 3860, lengthLongMm: 3860 }),
    ], extraProfiles)
    const photoSrc = (file: string) => `/profile-photo-check/photos/${file}`
    const cutting = renderCuttingPages({ plans, profiles: extraProfiles, labels, rtl: true, photoSrc }).html
    const order = renderOrderPages({
      plans,
      profiles: extraProfiles,
      rtl: true,
      photoSrc,
      labels: {
        title: 'הזמנה',
        wall: 'דופן',
        stock: 'מוט',
        bars: 'מוטות',
        meters: 'מטרים',
        weight: 'משקל',
        weightMissing: 'משקל לא הוגדר',
        profile: 'פרופיל',
        total: 'סה״כ',
        noImage: 'אין תמונה',
        noData: 'אין נתונים',
        schematic: 'חתך סכמטי',
        sharedDrawing: '',
        kerfNote: 'מרוח',
      },
    }).html
    expect(cutting).toContain('/profile-photo-check/photos/pa1162.jpg')
    expect(cutting).not.toContain('нет изображения')
    expect(order).toContain('/profile-photo-check/photos/pa1162.jpg')
    expect(order).not.toContain('אין תמונה')
    const chosen = plans[0].options.find((option) => option.stockLengthMm === plans[0].recommendedStockLengthMm)
    expect(plans[0].recommendedStockLengthMm).toBe(4000)
    expect(chosen?.plan?.totalBars).toBe(1)
  })

  it('puts 11 lamella bars on a page and keeps structural profiles at 6', () => {
    const many = [
      ...Array.from({ length: 12 }, (_, index) => piece({
        id: `lam-page-${index}`,
        role: 'lamella',
        profileId: 'f7020',
        lengthAxisMm: 5200 + index * 10,
        lengthLongMm: 5200 + index * 10,
      })),
      ...Array.from({ length: 7 }, (_, index) => piece({
        id: `beam-page-${index}`,
        lengthAxisMm: 6100 + index * 20,
        lengthLongMm: 6100 + index * 20,
      })),
    ]
    const html = renderCuttingPages({
      plans: buildProfileBundlePlans(many, profiles),
      profiles,
      labels,
      rtl: true,
    }).html
    const sections = html.split('<section').slice(1)
    const lamellaPages = sections.filter((section) => section.includes('f7020'))
    const beamPages = sections.filter((section) => section.includes('f10040'))
    const rows = (section: string) => section.match(/class="bar-row"/g)?.length ?? 0
    expect(lamellaPages.map(rows)).toEqual([11, 1])
    expect(beamPages.map(rows)).toEqual([6, 1])
  })
})
