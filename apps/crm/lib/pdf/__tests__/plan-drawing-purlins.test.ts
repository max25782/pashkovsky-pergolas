import { DEFAULT_PLAN_CONSTRUCTION_PARAMS, PERGOLA_PLAN_SCHEMA_VERSION } from '@pashkovsky/pergola-core'
import type { PergolaPlan } from '@/types/offer'

const RECTANGLE = [
  { x: 0, y: 0 },
  { x: 9000, y: 0 },
  { x: 9000, y: 4000 },
  { x: 0, y: 4000 },
]

function planOf(polygon: Array<{ x: number; y: number }>): PergolaPlan {
  return {
    schemaVersion: PERGOLA_PLAN_SCHEMA_VERSION,
    polygon,
    wallIndices: [],
    params: { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS },
    confirmed: true,
  }
}

describe('plan drawing in the offer PDF', () => {
  it('draws the cross dividers (purlins) inside the outline', async () => {
    const { generateDrawingsFromPlan } = await import('@/lib/pdf/polygon-plan-drawing.server')
    const drawings = await generateDrawingsFromPlan(planOf(RECTANGLE))
    const count = drawings?.topPlan?.match(/data-purlin="1"/g)?.length ?? 0
    // 9000 mm at the default span limit needs several dividers; the drawing used to show none.
    expect(count).toBeGreaterThan(2)
  })

  it('keeps the pergola in the PDF when the full drawing cannot be built', async () => {
    jest.resetModules()
    jest.doMock('@pashkovsky/pergola-core', () => ({
      ...jest.requireActual<typeof import('@pashkovsky/pergola-core')>('@pashkovsky/pergola-core'),
      buildPiecesFromPlan: () => {
        throw new Error('Structural violation - test')
      },
    }))
    const logged = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const { generateDrawingsFromPlan } = await import('@/lib/pdf/polygon-plan-drawing.server')
      const drawings = await generateDrawingsFromPlan(planOf(RECTANGLE))
      expect(drawings?.topPlan).toContain('data-plan-contour="legacy-axis"')
      expect(logged).toHaveBeenCalledTimes(1)
    } finally {
      logged.mockRestore()
      jest.dontMock('@pashkovsky/pergola-core')
    }
  })
})
