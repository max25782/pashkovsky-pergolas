/**
 * platform/ — Cross-cutting Infrastructure Layer
 *
 * PREFER importing from specific subsystems to avoid name collisions:
 *   import { requireCompanyAuth } from '@/platform/tenant'
 *   import { can } from '@/platform/permissions'
 *   import { requireAuth } from '@/platform/auth'
 *
 * This barrel is provided for convenience but may have conflicts
 * if multiple subsystems export the same name.
 */

export * from './auth'
export * from './tenant'
export * from './permissions'
export * from './billing'
export * from './ai'
export * from './audit'
