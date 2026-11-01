import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  buildLamellaSections,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  groupLamellaSectionTypes,
  PERGOLA_CONSTRUCTION_PROFILES,
  specFromPlan,
} from '@pashkovsky/pergola-core'
import type { Point2D } from '@pashkovsky/pergola-core'
import { LamellaSectionsSheet } from '@pashkovsky/pergola-drawing'
import { pentagonV2Contour, pentagonV2PlanParams } from './fixtures/skew-pentagon-850-2026-11-01-v2'

/**
 * A shape the section builder returns nothing for must not print an empty "Sections"
 * page. The production pack (flowPages) leaves the page out; the on-screen sheet says why
 * it is empty. The section builder itself is not touched.
 */
const LABELS = { title: 'Lamella sections', noSections: 'NO-SECTIONS-LINE' }

const flowMarkup = (sections: ReturnType<typeof buildLamellaSections>) =>
  renderToStaticMarkup(createElement(LamellaSectionsSheet, { sections, labels: LABELS, flowPages: true }))
const screenMarkup = (sections: ReturnType<typeof buildLamellaSections>) =>
  renderToStaticMarkup(createElement(LamellaSectionsSheet, { sections, labels: LABELS }))

describe.each([
  ['mirrored plan as shown in the editor (clockwise)', true],
  ['drawing frame (counter-clockwise)', false],
])('pentagon v2, %s', (_name, mirror) => {
  const contour = pentagonV2Contour(mirror)
  const params = pentagonV2PlanParams(DEFAULT_PLAN_CONSTRUCTION_PARAMS)
  const sections = buildLamellaSections(specFromPlan({ contour, wallEdgeIndices: [], params }), PERGOLA_CONSTRUCTION_PROFILES)

  it('has lamellas but no sections', () => {
    expect(sections).toHaveLength(0)
  })

  it('prints no sections page in the production pack', () => {
    const html = flowMarkup(sections)
    expect(html).toBe('')
    expect(html).not.toContain('data-pdf-page')
  })

  it('says on the screen sheet why it is empty', () => {
    const html = screenMarkup(sections)
    expect(html).toContain('data-sections-empty="1"')
    expect(html).toContain('NO-SECTIONS-LINE')
  })
})

describe('skew plan with 12 sections', () => {
  const CONTOUR: Point2D[] = [
    [0, 0],
    [6421.82181354009, 0],
    [6421.82181354009, 3726.450217473525],
    [-5163.666556354009, 3726.450217473526],
    [-5163.666556354011, -4924.179746596066],
    [212.0071388048409, -4924.179746596066],
  ]
  const params = {
    ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
    beamProfileId: 'f10040',
    lamellaGapMm: 20,
    wingShelfProfileId: 'purlin-plain-5030',
    wallBeamWidthVersion: 1 as const,
    wallProfileId: 'f10040',
    lamellaDirectionDeg: 0,
    purlinMaxSpanMm: 4000,
    purlinClearLayoutVersion: 1 as const,
    lamellaSectionLayoutVersion: 1 as const,
    frameJointVersion: 1 as const,
    purlinProfileId: 'PA3022',
  }
  const sections = buildLamellaSections(
    specFromPlan({ contour: CONTOUR, wallEdgeIndices: [], params }),
    PERGOLA_CONSTRUCTION_PROFILES,
  )

  it('still builds its 12 sections', () => {
    expect(sections).toHaveLength(12)
    expect(groupLamellaSectionTypes(sections).totalSections).toBe(12)
  })

  it('still prints its sections page and no empty-state line', () => {
    const flow = flowMarkup(sections)
    expect(flow).toContain('data-pdf-page')
    expect(flow).not.toContain('data-sections-empty')
    expect(flow).not.toContain('NO-SECTIONS-LINE')
    const screen = screenMarkup(sections)
    expect(screen).not.toContain('data-sections-empty')
    expect(screen).toContain('data-section-footer')
  })
})
