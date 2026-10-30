// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { LamellaSection, LamellaSectionTypeGroup } from '@pashkovsky/pergola-core'
import { LamellaSectionsSheet, cardsOverlap, layoutSectionTypeCards } from '../LamellaSectionsSheet'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

const AREA = { x: 48, y: 88, width: 1504, height: 420 }

function type(
  typeId: string,
  count: number,
  widthMm: number,
  heightMm: number,
  lamellasPerSection: number,
): LamellaSectionTypeGroup {
  return {
    typeId,
    count,
    widthMm,
    heightMm,
    sizeLabel: `${widthMm}×${heightMm}`,
    lamellasPerSection,
    lamellaLengthMm: widthMm,
    sectionIds: [],
  }
}

function section(id: string, widthMm: number, heightMm: number, lamellaCount: number): LamellaSection {
  return {
    id,
    widthMm,
    heightMm,
    clearWMm: widthMm + 15,
    clearHMm: heightMm + 30,
    lamellaCount,
    pitchMm: 90,
    minX: 0,
    maxX: widthMm,
    minY: 0,
    maxY: heightMm,
    faceX0: 'frame',
    faceX1: 'purlin',
    faceY0: 'support',
    faceY1: 'frame',
  }
}

const WALL_L_TYPES = [
  type('A', 7, 1359.3, 3860, 43),
  type('B', 3, 1359.3, 3930, 43),
  type('C', 1, 632.1, 3930, 43),
]

describe('LamellaSectionsSheet', () => {
  it('lays out the wall-L types to scale with W, H and quantity and no overlap', () => {
    const cards = layoutSectionTypeCards(WALL_L_TYPES, AREA)
    expect(cards.map((card) => [card.label, card.widthLabel, card.heightLabel])).toEqual([
      ['7', '1359', '3860'],
      ['3', '1359', '3930'],
      ['1', '632', '3930'],
    ])
    expect(cardsOverlap(cards)).toBe(false)
    const tall = cards.find((card) => card.typeId === 'B')
    const wide = cards.find((card) => card.typeId === 'A')
    expect(tall && wide && tall.rectH > wide.rectH).toBe(true)
  })

  it('prints one sheet: type letters, the schedule, and the totals', () => {
    const sections = [
      ...Array.from({ length: 7 }, (_, i) => section(`a-${i}`, 1359.3, 3860, 43)),
      ...Array.from({ length: 3 }, (_, i) => section(`b-${i}`, 1359.3, 3930, 43)),
      section('c-0', 632.1, 3930, 43),
    ]
    const { container } = render(<LamellaSectionsSheet sections={sections} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 1600 1000')
    const text = container.textContent ?? ''
    expect(text).toContain('A')
    expect(text).toContain('B')
    expect(text).toContain('C')
    expect(container.querySelector('[data-section-width="1359"]')).not.toBeNull()
    expect(container.querySelector('[data-section-height="3860"]')).not.toBeNull()
    expect(container.querySelector('[data-section-qty="7 pcs"]')).not.toBeNull()
    expect(text).toContain('1359×3860')
    expect(text).toContain('Lamellas: 473')
    expect(text).toContain('Sections: 11')
    expect(Number(container.querySelector('[data-section-height="3860"]')?.getAttribute('data-height-gap'))).toBeGreaterThanOrEqual(28)
  })

  it('draws a skew section as a trapezoid with top and bottom widths', () => {
    const skew = section('c-0', 870.1, 4874.2, 54)
    skew.trapezoid = {
      corners: [
        [-791.6, -4889.2],
        [183, -4889.2],
        [-26.9, -15],
        [-791.6, -15],
      ],
      widthAtLowMm: 974.6,
      widthAtHighMm: 764.7,
      lamellaLengthsMm: [971, 766],
    }
    const { container } = render(<LamellaSectionsSheet sections={[skew]} />)
    expect(container.querySelector('[data-section-trapezoid="1"]')).not.toBeNull()
    expect(container.querySelector('[data-section-top="764"]')).not.toBeNull()
    expect(container.querySelector('[data-section-width="974"]')).not.toBeNull()
    expect(container.textContent).toContain('764/974×4874')
    expect(container.textContent).toContain('766 / 971')
    expect(container.querySelector('[data-trapezoid-rows="1"]')).not.toBeNull()
    expect(container.querySelector('[data-lamella-row="1"]')?.getAttribute('data-lamella-row-length')).toBe('766')
    expect(container.querySelector('[data-lamella-row="2"]')?.getAttribute('data-lamella-row-length')).toBe('971')
    expect(container.textContent).toContain('Row → lamella length')
    const bottoms = [...container.querySelectorAll('[data-lamella-row]')].map((node) => Number(node.getAttribute('y')))
    expect(Math.max(...bottoms)).toBeLessThan(1000)
  })

  it('fits fifty-four trapezoid rows on the sheet in several columns', () => {
    const skew = section('c-0', 870.1, 4874.2, 54)
    skew.trapezoid = {
      corners: [
        [-791.6, -4889.2],
        [183, -4889.2],
        [-26.9, -15],
        [-791.6, -15],
      ],
      widthAtLowMm: 974.6,
      widthAtHighMm: 764.7,
      lamellaLengthsMm: Array.from({ length: 54 }, (_, index) => 971 - index),
    }
    const { container } = render(
      <LamellaSectionsSheet
        sections={[
          ...Array.from({ length: 8 }, (_, i) => section(`a-${i}`, 1393.2, 3636.5, 40)),
          ...Array.from({ length: 3 }, (_, i) => section(`b-${i}`, 1393.2, 4874.2, 54)),
          skew,
        ]}
      />,
    )
    const rows = [...container.querySelectorAll('[data-lamella-row]')]
    expect(rows).toHaveLength(54)
    expect(rows[0]?.getAttribute('data-lamella-row-length')).toBe(String(971 - 53))
    const ys = rows.map((node) => Number(node.getAttribute('y')))
    expect(Math.max(...ys)).toBeLessThan(1000)
    const xs = new Set(rows.map((node) => node.getAttribute('x')))
    expect(xs.size).toBeGreaterThan(1)
  })
})
