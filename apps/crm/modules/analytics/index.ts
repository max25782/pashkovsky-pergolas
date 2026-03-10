/**
 * modules/analytics — Dashboard Analytics & AI Summaries
 *
 * Canonical import path for all analytics-related code.
 * New code should import from '@/modules/analytics'.
 *
 * Responsibilities:
 *   - Dashboard data aggregation
 *   - Revenue & deal snapshots
 *   - Weekly digest generation
 *   - AI analytics context building
 */

// Aggregators (leads, deals, finance summaries)
export {
  getDateRange,
  getLeadsSummary,
  getDealsSummary,
  getFinanceSummary,
  type LeadsSummary,
  type DealsSummary,
  type FinanceSummary,
} from '@/lib/analytics/aggregators'

// Weekly digest
export {
  generateWeeklyDigest,
  getWeeklyDigests,
  getWeeklyDigest,
  type WeeklyDigestResult,
} from '@/lib/analytics/weeklyDigest'

// AI analytics context builder (lives in lib/ai but belongs to analytics domain)
export {
  buildAnalyticsContext,
  type BuildAnalyticsContextParams,
} from '@/lib/ai/buildAnalyticsContext'

// Analytics types — also available from @/platform/ai for platform-level usage
export {
  type AnalyticsMode,
  type AnalyticsPeriod,
  type AnalyticsContext,
  type AnalyticsContextResponse,
} from '@/lib/ai/analyticsTypes'

// UI Components
export { default as DealsCharts } from '@/components/admin/DealsCharts'
export { default as MonthlyReportCharts } from '@/components/admin/MonthlyReportCharts'
export { default as MonthlyStatsChart } from '@/components/admin/MonthlyStatsChart'
export { default as MonthlyDealsModal } from '@/components/admin/MonthlyDealsModal'
