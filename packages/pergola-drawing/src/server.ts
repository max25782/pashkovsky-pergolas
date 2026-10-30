/**
 * Server-safe exports (no React). Use from PDF / Node — not the main barrel.
 */
export { beamSplicePoints, groupBeamsIntoGeometricSides } from './geometry/beamRuns'
export type { GeometricSide } from './geometry/beamRuns'
export { renderPlanDimensionsSvg, collectPlanDimensionWorldPoints } from './planDimensionsSvg'
export type { PlanDimensionsSvgInput } from './planDimensionsSvg'
