/**
 * modules/ — Domain Feature Slices
 *
 * PREFER importing from specific modules to avoid name collisions:
 *   import { useLeads } from '@/modules/leads'
 *   import { calculateOffer } from '@/modules/offers'
 *   import { buildAnalyticsContext } from '@/modules/analytics'
 *
 * This barrel is provided for convenience but may have conflicts
 * if multiple modules export the same name.
 */

export * from './leads'
export * from './deals'
export * from './workers'
export * from './projects'
export * from './offers'
export * from './analytics'
