/**
 * Build Analytics Context for AI
 * 
 * This function aggregates data from the database and prepares it for AI analysis.
 * Rule: AI never accesses database directly - all data comes through this function.
 */

import type {
  AnalyticsContext,
  AnalyticsMode,
  AnalyticsPeriod,
  LeadsAnalyticsSummary,
  DealsAnalyticsSummary,
  FinanceAnalyticsSummary,
} from './analyticsTypes'
import { DEFAULT_TIMEZONE } from './analyticsTypes'
import {
  getLeadsSummary,
  getDealsSummary,
  getFinanceSummary,
  type LeadsSummary,
  type DealsSummary,
  type FinanceSummary,
} from '@/lib/analytics/aggregators'

// ============================================================================
// Type Definitions for Metrics
// ============================================================================

interface MetricDefinitions {
  revenue: string
  winRate: string
  duplicates: string
  conversionRate: string
  profitMargin: string
  avgResponseTime: string
  avgDaysToClose: string
  laborCost: string
  [key: string]: string
}

const METRIC_DEFINITIONS: MetricDefinitions = {
  revenue: 'Sum of deals.price OR offers.final_price for deals with stage="done". If deal has no price, uses the highest final_price from associated offers.',
  winRate: 'Percentage of deals with stage="done" out of total deals in period. Represents completion rate, not win/loss ratio.',
  duplicates: 'Leads with the same phone number. Counted when multiple leads share identical phone.',
  conversionRate: 'Percentage of leads that have an associated deal (via lead_id in deals table).',
  profitMargin: 'Percentage calculated as (profit / revenue) * 100. Profit = revenue - laborCost.',
  avgResponseTime: 'Average minutes between lead.created_at and lead.last_message_at. Only calculated for leads with both timestamps.',
  avgDaysToClose: 'Average days between deal.created_at and deal.updated_at for deals with stage="done".',
  laborCost: 'Sum of work_shifts.daily_rate_snapshot for all shifts in the period. Includes all shifts regardless of project status.',
  profit: 'Revenue minus laborCost. Can be negative if labor costs exceed revenue.',
  qualifiedLeads: 'Leads with status="qualified". Represents leads that passed initial screening.',
  stalledDeals: 'Deals that have not changed stage for more than 30 days. Based on deal.updated_at timestamp.',
}

// ============================================================================
// Main Function
// ============================================================================

export interface BuildAnalyticsContextParams {
  mode: AnalyticsMode
  period: AnalyticsPeriod
  companyId?: string
}

export async function buildAnalyticsContext({
  mode,
  period,
  companyId,
}: BuildAnalyticsContextParams): Promise<AnalyticsContext> {
  const assumptions: string[] = []
  const dataGaps: string[] = []
  
  // Ensure timezone is set
  const normalizedPeriod: AnalyticsPeriod = {
    ...period,
    tz: period.tz || DEFAULT_TIMEZONE,
  }

  // Initialize context structure
  const context: AnalyticsContext = {
    mode,
    period: normalizedPeriod,
    generatedAt: new Date().toISOString(),
    timezone: normalizedPeriod.tz,
    metadata: {
      definitions: METRIC_DEFINITIONS,
    },
  }

  // Fetch data based on mode
  try {
    // Always fetch leads summary for "leads" and "manager" modes
    if (mode === 'leads' || mode === 'manager') {
      try {
        const leadsData = await getLeadsSummary(normalizedPeriod, companyId)
        const leadsSummary: LeadsAnalyticsSummary = {
          period: normalizedPeriod,
          totalLeads: leadsData.totalLeads,
          newLeads: leadsData.newLeads,
          qualifiedLeads: leadsData.qualifiedLeads,
          duplicateLeads: leadsData.duplicateLeads,
          convertedLeads: leadsData.conversionToDeal > 0 
            ? Math.round((leadsData.conversionToDeal / 100) * leadsData.totalLeads)
            : 0,
          byStatus: leadsData.statusBreakdown,
          bySource: leadsData.sourceBreakdown,
          conversionRate: leadsData.conversionToDeal,
          averageDaysToConvert: null, // Not calculated in aggregator
          avgResponseTimeMinutes: leadsData.avgResponseTimeMinutes,
          topSources: Object.entries(leadsData.sourceBreakdown)
            .map(([source, count]) => ({
              source,
              count,
              conversionRate: 0, // Would need additional query to calculate per-source conversion
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5),
        }

        context.leads = leadsSummary

        // Check for data gaps
        if (leadsData.avgResponseTimeMinutes === null && leadsData.totalLeads > 0) {
          dataGaps.push('Average response time not available - some leads missing last_message_at timestamp')
        }
        if (leadsData.totalLeads === 0) {
          dataGaps.push('No leads found in the specified period')
        }
        if (leadsData.conversionToDeal === 0 && leadsData.totalLeads > 0) {
          assumptions.push('No lead-to-deal conversions detected - may indicate missing lead_id links in deals table')
        }
        dataGaps.push('Per-source conversion rates not calculated - requires additional queries')
        dataGaps.push('Average days to convert not calculated - requires tracking conversion timestamps')
      } catch (error: any) {
        dataGaps.push(`Failed to fetch leads data: ${error.message}`)
      }
    }

    // Always fetch deals summary for "deals", "finance", and "manager" modes
    if (mode === 'deals' || mode === 'finance' || mode === 'manager') {
      try {
        const dealsData = await getDealsSummary(normalizedPeriod, companyId)
        const dealsSummary: DealsAnalyticsSummary = {
          period: normalizedPeriod,
          totalDeals: dealsData.totalDeals,
          activeDeals: dealsData.openDeals,
          completedDeals: dealsData.wonDeals,
          byStage: dealsData.stageBreakdown,
          byProjectType: {
            pergola: 0, // Would need additional query
            railing: 0,
            gates: 0,
            windows: 0,
            other: 0,
          },
          totalRevenue: 0, // Will be filled from finance summary if available
          totalCost: 0,
          totalProfit: 0,
          averageDealValue: dealsData.avgDealValue,
          averageProfitMargin: 0, // Will be calculated from finance if available
          winRate: dealsData.winRate,
          avgDaysToClose: dealsData.avgDaysToClose,
          averageDaysInStage: {}, // Would need additional calculation
          dealsStuckInStage: dealsData.topIssues
            .filter(issue => issue.includes('stalled'))
            .map(issue => ({
              stage: 'unknown', // Would need to parse from issue
              count: 0,
              averageDays: 0,
            })),
          topCustomers: [], // Would need additional query
        }

        context.deals = dealsSummary

        // Check for data gaps
        if (dealsData.avgDaysToClose === null && dealsData.wonDeals > 0) {
          dataGaps.push('Average days to close not available - some won deals missing updated_at timestamp')
        }
        if (dealsData.avgDealValue === 0 && dealsData.totalDeals > 0) {
          dataGaps.push('Average deal value is zero - deals may be missing price data')
        }
        if (dealsData.totalDeals === 0) {
          dataGaps.push('No deals found in the specified period')
        }
        dataGaps.push('Project type breakdown not calculated - requires additional query')
        dataGaps.push('Average days in stage not calculated - requires stage transition tracking')
        dataGaps.push('Top customers list not generated - requires additional aggregation')
      } catch (error: any) {
        dataGaps.push(`Failed to fetch deals data: ${error.message}`)
      }
    }

    // Fetch finance summary for "finance" and "manager" modes
    if (mode === 'finance' || mode === 'manager') {
      try {
        const financeData = await getFinanceSummary(normalizedPeriod, companyId)
        const financeSummary: FinanceAnalyticsSummary = {
          period: normalizedPeriod,
          totalRevenue: financeData.revenue,
          totalRevenueWithVAT: Math.round(financeData.revenue * 1.18), // Assuming 18% VAT
          revenueByMonth: [], // Would need monthly breakdown
          totalCosts: financeData.laborCost,
          materialCosts: 0, // Not tracked separately
          laborCosts: financeData.laborCost,
          otherCosts: 0,
          totalProfit: financeData.profit,
          profitMargin: financeData.profitMargin,
          profitByMonth: [],
          totalVAT: Math.round(financeData.revenue * 0.18),
          vatPercent: 18,
          cashFlow: [],
        }

        context.finance = financeSummary

        // Update deals summary with finance data if available
        if (context.deals) {
          context.deals.totalRevenue = financeData.revenue
          context.deals.totalCost = financeData.laborCost
          context.deals.totalProfit = financeData.profit
          context.deals.averageProfitMargin = financeData.profitMargin
        }

        // Check for data gaps
        if (financeData.revenue === 0) {
          dataGaps.push('Revenue is zero - no completed deals with price data found in period')
        }
        if (financeData.laborCost === 0 && financeData.revenue > 0) {
          assumptions.push('Labor costs are zero - work shifts may not be tracked for this period')
        }
        if (financeData.profitMargin < 0) {
          assumptions.push('Negative profit margin indicates labor costs exceed revenue')
        }
        dataGaps.push('Monthly revenue/profit breakdown not calculated - requires date grouping')
        dataGaps.push('Cash flow timeline not generated - requires daily aggregation')
        dataGaps.push('Material costs not tracked separately - only labor costs available')
        dataGaps.push('Revenue projections not calculated - requires historical trend analysis')
      } catch (error: any) {
        dataGaps.push(`Failed to fetch finance data: ${error.message}`)
      }
    }

    // Add assumptions based on mode
    assumptions.push(`Analysis period: ${normalizedPeriod.from} to ${normalizedPeriod.to} (${normalizedPeriod.tz})`)
    assumptions.push('All monetary values are in ILS (Israeli Shekel)')
    assumptions.push('Dates are filtered using Asia/Jerusalem timezone')
    
    if (mode === 'finance') {
      assumptions.push('Revenue calculated from deals with stage="done" OR offers with final_price')
      assumptions.push('Labor costs include all work shifts in period, regardless of deal status')
    }

    if (mode === 'leads') {
      assumptions.push('Duplicate detection based on phone number matching')
      assumptions.push('Conversion rate calculated by checking if lead_id exists in deals table')
    }

    if (mode === 'deals') {
      assumptions.push('Win rate represents completion rate (done deals / total deals)')
      assumptions.push('Stalled deals are those unchanged for >30 days')
    }

  } catch (error: any) {
    dataGaps.push(`Critical error building analytics context: ${error.message}`)
  }

  // Add notes to context metadata
  if (!context.metadata) {
    context.metadata = {}
  }
  
  context.metadata.notes = {
    assumptions,
    dataGaps,
  }

  // Remove undefined fields to keep context compact
  if (context.leads && !context.leads.trends) {
    delete context.leads.trends
  }
  if (context.deals && !context.deals.trends) {
    delete context.deals.trends
  }
  if (context.finance && !context.finance.trends) {
    delete context.finance.trends
  }

  return context
}

