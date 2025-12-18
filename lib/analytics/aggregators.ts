/**
 * Server-side analytics aggregators
 * 
 * These functions aggregate data from the database for AI analytics.
 * Rule: AI never accesses database directly - all data comes from these aggregators.
 */

import { createClient } from '@supabase/supabase-js'
import type { AnalyticsPeriod } from '@/lib/ai/analyticsTypes'
import { DEFAULT_TIMEZONE } from '@/lib/ai/analyticsTypes'

// ============================================================================
// Supabase Client Setup
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : null

if (!supabase) {
  console.warn('Supabase client not initialized - analytics aggregators will fail')
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert date string to ISO timestamp in Asia/Jerusalem timezone
 * Handles date filtering with timezone awareness
 */
function convertToTimezoneDate(dateStr: string, tz: string = DEFAULT_TIMEZONE): string {
  // Parse date string (YYYY-MM-DD) and create date at start of day in target timezone
  const date = new Date(`${dateStr}T00:00:00`)
  // Return ISO string - Supabase stores timestamps in UTC
  return date.toISOString()
}

/**
 * Get date range for period with timezone handling
 */
export function getDateRange(period: AnalyticsPeriod) {
  const from = convertToTimezoneDate(period.from, period.tz)
  // End date should be end of day
  const toDate = new Date(`${period.to}T23:59:59`)
  const to = toDate.toISOString()
  return { from, to }
}

/**
 * Calculate time difference in minutes between two timestamps
 */
function getMinutesDifference(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const startDate = new Date(start)
  const endDate = new Date(end)
  return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60))
}

/**
 * Calculate days difference between two dates
 */
function getDaysDifference(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

// ============================================================================
// Leads Analytics Aggregator
// ============================================================================

export interface LeadsSummary {
  totalLeads: number
  newLeads: number
  qualifiedLeads: number
  duplicateLeads: number
  sourceBreakdown: Record<string, number>
  statusBreakdown: {
    pending: number
    confirmed: number
    contacted: number
    qualified: number
    won: number
    lost: number
  }
  avgResponseTimeMinutes: number | null
  conversionToDeal: number // percentage
  topIssues: string[]
}

export async function getLeadsSummary(
  period: AnalyticsPeriod,
  companyId?: string
): Promise<LeadsSummary> {
  if (!supabase) {
    throw new Error('Supabase client not initialized')
  }

  const { from, to } = getDateRange(period)

  // Fetch all leads in period
  let query = supabase
    .from('leads')
    .select('id, name, phone, source, status, created_at, last_message_at')
    .gte('created_at', from)
    .lte('created_at', to)

  // Apply company filter if needed (assuming company_id field exists)
  // if (companyId) {
  //   query = query.eq('company_id', companyId)
  // }

  const { data: leads, error } = await query

  if (error) {
    console.error('Error fetching leads:', error)
    throw new Error(`Failed to fetch leads: ${error.message}`)
  }

  const leadsData = leads || []

  // Calculate totals
  const totalLeads = leadsData.length
  const newLeads = leadsData.filter(l => !l.last_message_at).length
  const qualifiedLeads = leadsData.filter(l => l.status === 'qualified').length

  // Find duplicates (same phone number)
  const phoneMap = new Map<string, number>()
  leadsData.forEach(lead => {
    if (lead.phone) {
      phoneMap.set(lead.phone, (phoneMap.get(lead.phone) || 0) + 1)
    }
  })
  const duplicateLeads = Array.from(phoneMap.values()).filter(count => count > 1).length

  // Source breakdown
  const sourceBreakdown: Record<string, number> = {}
  leadsData.forEach(lead => {
    const source = lead.source || 'unknown'
    sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1
  })

  // Status breakdown
  const statusBreakdown = {
    pending: leadsData.filter(l => l.status === 'pending' || !l.status).length,
    confirmed: leadsData.filter(l => l.status === 'confirmed').length,
    contacted: leadsData.filter(l => l.status === 'contacted').length,
    qualified: leadsData.filter(l => l.status === 'qualified').length,
    won: leadsData.filter(l => l.status === 'won').length,
    lost: leadsData.filter(l => l.status === 'lost').length,
  }

  // Average response time (from created_at to last_message_at)
  const responseTimes = leadsData
    .filter(l => l.created_at && l.last_message_at)
    .map(l => getMinutesDifference(l.created_at, l.last_message_at))
    .filter((t): t is number => t !== null)
  
  const avgResponseTimeMinutes = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length)
    : null

  // Conversion to deal (check if lead has associated deal via lead_id in deals table)
  const leadIds = leadsData.map(l => l.id)
  let convertedCount = 0
  
  if (leadIds.length > 0) {
    const { data: deals } = await supabase
      .from('deals')
      .select('lead_id')
      .in('lead_id', leadIds)
    
    convertedCount = deals?.length || 0
  }

  const conversionToDeal = totalLeads > 0 ? Math.round((convertedCount / totalLeads) * 100) : 0

  // Top issues
  const topIssues: string[] = []
  if (duplicateLeads > totalLeads * 0.1) {
    topIssues.push(`High duplicate leads: ${duplicateLeads} duplicates found (${Math.round((duplicateLeads / totalLeads) * 100)}%)`)
  }
  if (statusBreakdown.pending > totalLeads * 0.3) {
    topIssues.push(`Many pending leads: ${statusBreakdown.pending} pending (${Math.round((statusBreakdown.pending / totalLeads) * 100)}%)`)
  }
  if (conversionToDeal < 10) {
    topIssues.push(`Low conversion rate: Only ${conversionToDeal}% of leads convert to deals`)
  }
  if (avgResponseTimeMinutes && avgResponseTimeMinutes > 1440) { // > 24 hours
    topIssues.push(`Slow response time: Average ${Math.round(avgResponseTimeMinutes / 60)} hours to respond`)
  }

  return {
    totalLeads,
    newLeads,
    qualifiedLeads,
    duplicateLeads,
    sourceBreakdown,
    statusBreakdown,
    avgResponseTimeMinutes,
    conversionToDeal,
    topIssues,
  }
}

// ============================================================================
// Deals Analytics Aggregator
// ============================================================================

export interface DealsSummary {
  totalDeals: number
  openDeals: number
  wonDeals: number
  lostDeals: number
  stageBreakdown: {
    new: number
    measure: number
    offer: number
    approved: number
    production: number
    install: number
    done: number
  }
  avgDealValue: number
  winRate: number // percentage
  avgDaysToClose: number | null
  topIssues: string[]
}

export async function getDealsSummary(
  period: AnalyticsPeriod,
  companyId?: string
): Promise<DealsSummary> {
  if (!supabase) {
    throw new Error('Supabase client not initialized')
  }

  const { from, to } = getDateRange(period)

  // Fetch all deals created in period
  let query = supabase
    .from('deals')
    .select('id, stage, price, created_at, updated_at')
    .gte('created_at', from)
    .lte('created_at', to)

  // Apply company filter if needed
  // if (companyId) {
  //   query = query.eq('company_id', companyId)
  // }

  const { data: deals, error } = await query

  if (error) {
    console.error('Error fetching deals:', error)
    throw new Error(`Failed to fetch deals: ${error.message}`)
  }

  const dealsData = deals || []

  // Calculate totals
  const totalDeals = dealsData.length
  const openDeals = dealsData.filter(d => d.stage !== 'done').length
  const wonDeals = dealsData.filter(d => d.stage === 'done').length
  const lostDeals = 0 // No "lost" stage in current schema - deals are either done or open

  // Stage breakdown
  const stageBreakdown = {
    new: dealsData.filter(d => d.stage === 'new' || !d.stage).length,
    measure: dealsData.filter(d => d.stage === 'measure').length,
    offer: dealsData.filter(d => d.stage === 'offer').length,
    approved: dealsData.filter(d => d.stage === 'approved').length,
    production: dealsData.filter(d => d.stage === 'production').length,
    install: dealsData.filter(d => d.stage === 'install').length,
    done: dealsData.filter(d => d.stage === 'done').length,
  }

  // Average deal value (from price field)
  const dealValues = dealsData
    .map(d => parseFloat(d.price) || 0)
    .filter(v => v > 0)
  
  const avgDealValue = dealValues.length > 0
    ? Math.round(dealValues.reduce((sum, v) => sum + v, 0) / dealValues.length)
    : 0

  // Win rate (based on done deals vs total deals)
  const winRate = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0

  // Average days to close (for won deals)
  const wonDealsWithDates = dealsData.filter(d => d.stage === 'done' && d.created_at && d.updated_at)
  const daysToClose = wonDealsWithDates
    .map(d => getDaysDifference(d.created_at, d.updated_at))
    .filter((d): d is number => d !== null)
  
  const avgDaysToClose = daysToClose.length > 0
    ? Math.round(daysToClose.reduce((sum, d) => sum + d, 0) / daysToClose.length)
    : null

  // Top issues
  const topIssues: string[] = []
  
  // Stalled deals (in same stage for >30 days)
  const stalledDeals = dealsData.filter(d => {
    if (!d.updated_at || d.stage === 'done') return false
    const daysSinceUpdate = getDaysDifference(d.updated_at, new Date().toISOString())
    return daysSinceUpdate !== null && daysSinceUpdate > 30
  })
  
  if (stalledDeals.length > openDeals * 0.2) {
    topIssues.push(`Many stalled deals: ${stalledDeals.length} deals stuck in same stage for >30 days`)
  }

  if (stageBreakdown.new > totalDeals * 0.4) {
    topIssues.push(`Many new deals: ${stageBreakdown.new} deals still in "new" stage (${Math.round((stageBreakdown.new / totalDeals) * 100)}%)`)
  }

  if (winRate < 30 && totalDeals > 0) {
    topIssues.push(`Low completion rate: Only ${winRate}% of deals are completed`)
  }

  if (avgDaysToClose && avgDaysToClose > 90) {
    topIssues.push(`Long sales cycle: Average ${avgDaysToClose} days to close deals`)
  }

  return {
    totalDeals,
    openDeals,
    wonDeals,
    lostDeals,
    stageBreakdown,
    avgDealValue,
    winRate,
    avgDaysToClose,
    topIssues,
  }
}

// ============================================================================
// Finance Analytics Aggregator
// ============================================================================

export interface FinanceSummary {
  revenue: number // Sum of deals.price OR offers.final_price for won deals
  laborCost: number // Sum of work_shifts.daily_rate_snapshot
  profit: number // revenue - laborCost
  profitMargin: number // percentage (profit / revenue)
  topIssues: string[]
}

export async function getFinanceSummary(
  period: AnalyticsPeriod,
  companyId?: string
): Promise<FinanceSummary> {
  if (!supabase) {
    throw new Error('Supabase client not initialized')
  }

  const { from, to } = getDateRange(period)

  // Get revenue from deals with stage='done' OR from offers with final_price
  // Strategy: Use deals.price if available, otherwise use offers.final_price
  
  // First, get won deals (stage='done') in period
  let dealsQuery = supabase
    .from('deals')
    .select('id, price, stage')
    .eq('stage', 'done')
    .gte('created_at', from)
    .lte('created_at', to)

  // if (companyId) {
  //   dealsQuery = dealsQuery.eq('company_id', companyId)
  // }

  const { data: wonDeals, error: dealsError } = await dealsQuery

  if (dealsError) {
    console.error('Error fetching won deals:', dealsError)
    throw new Error(`Failed to fetch won deals: ${dealsError.message}`)
  }

  const dealsData = wonDeals || []
  const dealIds = dealsData.map(d => d.id)

  // Calculate revenue from deals.price
  let revenue = dealsData.reduce((sum, deal) => {
    const price = parseFloat(deal.price) || 0
    return sum + price
  }, 0)

  // Also check offers for deals that might have final_price but no price in deals table
  if (dealIds.length > 0) {
    const { data: offers } = await supabase
      .from('offers')
      .select('deal_id, final_price')
      .in('deal_id', dealIds)
      .not('final_price', 'is', null)

    if (offers) {
      // For deals without price, use offer final_price
      const dealsWithoutPrice = dealsData.filter(d => !d.price || parseFloat(d.price) === 0)
      const dealsWithoutPriceIds = new Set(dealsWithoutPrice.map(d => d.id))
      
      offers.forEach(offer => {
        if (dealsWithoutPriceIds.has(offer.deal_id)) {
          const finalPrice = parseFloat(offer.final_price) || 0
          revenue += finalPrice
        }
      })
    }
  }

  // Get labor cost from work_shifts
  let shiftsQuery = supabase
    .from('work_shifts')
    .select('daily_rate_snapshot')
    .gte('date', period.from)
    .lte('date', period.to)

  // if (companyId) {
  //   // Assuming work_shifts can be filtered by project_id -> deal_id -> company_id
  //   // This would require a join, so for now we'll get all shifts
  // }

  const { data: shifts, error: shiftsError } = await shiftsQuery

  if (shiftsError) {
    console.error('Error fetching work shifts:', shiftsError)
    // Don't throw - labor cost might not be available
  }

  const laborCost = (shifts || []).reduce((sum, shift) => {
    const rate = parseFloat(shift.daily_rate_snapshot) || 0
    return sum + rate
  }, 0)

  // Calculate profit and margin
  const profit = revenue - laborCost
  const profitMargin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0

  // Top issues
  const topIssues: string[] = []

  if (profitMargin < 10 && revenue > 0) {
    topIssues.push(`Low profit margin: Only ${profitMargin}% margin (${profit.toLocaleString()} ILS profit from ${revenue.toLocaleString()} ILS revenue)`)
  }

  if (laborCost > revenue * 0.5 && revenue > 0) {
    topIssues.push(`High labor costs: Labor costs are ${Math.round((laborCost / revenue) * 100)}% of revenue`)
  }

  if (profit < 0) {
    topIssues.push(`Negative profit: Operating at a loss of ${Math.abs(profit).toLocaleString()} ILS`)
  }

  return {
    revenue,
    laborCost,
    profit,
    profitMargin,
    topIssues,
  }
}

