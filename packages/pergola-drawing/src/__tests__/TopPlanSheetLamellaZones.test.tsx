// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  buildPieces,
  specFromPlan,
} from '@pashkovsky/pergola-core'
import type { LamellaZone, PlanConstructionParams, Point2D } from '@pashkovsky/pergola-core'
import { SLANTED_WING_CONTOUR_MM } from '../../../pergola-core/src/acceptance/slantedWingContour'
import { TopPlanSheet } from '../TopPlanSheet'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

const WING_ZONE: LamellaZone = { id: 'wing', cutEdgeIndex: 2, lamellaEdgeIndex: 2, dividerEdgeIndex: 1 }

function renderWing(zones: boolean) {
  const params = {
    ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
    lamellaDirectionDeg: 90,
    contourReference: 'outer-faces',
    ...(zones ? { lamellaZones: [WING_ZONE] } : {}),
  } as PlanConstructionParams
  const contour: Point2D[] = SLANTED_WING_CONTOUR_MM
  const built = buildPieces(specFromPlan({ contour, wallEdgeIndices: [], params }), PERGOLA_CONSTRUCTION_PROFILES)
  return render(
    <TopPlanSheet
      pieces={built.pieces}
      profiles={PERGOLA_CONSTRUCTION_PROFILES}
      planContour={contour}
      constructionParams={params}
      lamellaDirectionDeg={90}
      lamellaDirectionLabel="lamella direction"
      autoDividerLabel="added automatically"
    />,
  )
}

describe('TopPlanSheet with a lamella zone', () => {
  it('draws one direction arrow per area when the plan has a zone', () => {
    const { container } = renderWing(true)
    expect(container.querySelectorAll('[data-lamella-direction="1"]')).toHaveLength(2)
  })

  it('draws a single arrow when the plan has no zones', () => {
    const { container } = renderWing(false)
    expect(container.querySelectorAll('[data-lamella-direction="1"]')).toHaveLength(1)
  })

  it('marks the dividers the builder added, with a legend line', () => {
    const { container } = renderWing(true)
    expect(container.querySelectorAll('[data-auto-divider="1"]').length).toBeGreaterThan(0)
    expect(container.querySelector('[data-auto-divider-legend="1"]')?.textContent).toBe('added automatically')
  })

  it('shows no legend for a plan saved without the automatic dividers', () => {
    const params = {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      lamellaDirectionDeg: 90,
      contourReference: 'outer-faces',
      overhangDividerVersion: undefined,
    } as PlanConstructionParams
    const contour: Point2D[] = SLANTED_WING_CONTOUR_MM
    const built = buildPieces(specFromPlan({ contour, wallEdgeIndices: [], params }), PERGOLA_CONSTRUCTION_PROFILES)
    const { container } = render(
      <TopPlanSheet
        pieces={built.pieces}
        profiles={PERGOLA_CONSTRUCTION_PROFILES}
        planContour={contour}
        constructionParams={params}
        lamellaDirectionDeg={90}
        lamellaDirectionLabel="lamella direction"
        autoDividerLabel="added automatically"
      />,
    )
    expect(container.querySelector('[data-auto-divider-legend="1"]')).toBeNull()
  })
})
