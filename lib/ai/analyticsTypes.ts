/**
 * AI Analytics Types
 * 
 * Types for AI-powered analytics in CRM.
 * Rule: AI does NOT have direct database access.
 * All data for AI comes from buildAnalyticsContext() on the server.
 */

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_VAT_PERCENT = 18
export const DEFAULT_TIMEZONE = 'Asia/Jerusalem'

// ============================================================================
// Enums & Unions
// ============================================================================

export type AnalyticsMode = 'leads' | 'deals' | 'finance' | 'manager'

// ============================================================================
// Core Types
// ============================================================================

/**
 * Time period for analytics queries
 */
export interface AnalyticsPeriod {
  from: string // ISO 8601 date string (YYYY-MM-DD)
  to: string // ISO 8601 date string (YYYY-MM-DD)
  tz: typeof DEFAULT_TIMEZONE // Timezone identifier
}

// ============================================================================
// Leads Analytics
// ============================================================================

export interface LeadsAnalyticsSummary {
  // Period information
  period: AnalyticsPeriod
  
  // Totals
  totalLeads: number
  newLeads: number
  qualifiedLeads: number
  duplicateLeads: number
  convertedLeads: number
  
  // Status breakdown
  byStatus: {
    pending: number
    confirmed: number
    contacted: number
    qualified: number
    won: number
    lost: number
  }
  
  // Source breakdown
  bySource: Record<string, number> // source -> count
  
  // Conversion metrics
  conversionRate: number // percentage (0-100)
  averageDaysToConvert: number | null // days, null if no conversions
  avgResponseTimeMinutes: number | null // average response time in minutes, null if not available
  
  // Top sources
  topSources: Array<{
    source: string
    count: number
    conversionRate: number
  }>
  
  // Trends (if comparing periods)
  trends?: {
    totalLeadsChange: number // percentage change
    conversionRateChange: number // percentage change
  }
}

// ============================================================================
// Deals Analytics
// ============================================================================

export interface DealsAnalyticsSummary {
  // Period information
  period: AnalyticsPeriod
  
  // Totals
  totalDeals: number
  activeDeals: number
  completedDeals: number
  
  // Stage breakdown
  byStage: {
    new: number
    measure: number
    offer: number
    approved: number
    production: number
    install: number
    done: number
  }
  
  // Project type breakdown
  byProjectType: {
    pergola: number
    railing: number
    gates: number
    windows: number
    other: number
  }
  
  // Financial summary
  totalRevenue: number // ILS
  totalCost: number // ILS
  totalProfit: number // ILS
  averageDealValue: number // ILS
  averageProfitMargin: number // percentage (0-100)
  winRate: number // percentage (0-100)
  avgDaysToClose: number | null // average days to close deal, null if no closed deals
  
  // Deal flow metrics
  averageDaysInStage: Record<string, number> // stage -> average days
  dealsStuckInStage: Array<{
    stage: string
    count: number
    averageDays: number
  }>
  
  // Top customers
  topCustomers: Array<{
    customerName: string
    dealCount: number
    totalValue: number
  }>
  
  // Trends (if comparing periods)
  trends?: {
    totalDealsChange: number
    revenueChange: number
    profitChange: number
  }
}

// ============================================================================
// Finance Analytics
// ============================================================================

export interface FinanceAnalyticsSummary {
  // Period information
  period: AnalyticsPeriod
  
  // Revenue
  totalRevenue: number // ILS (excluding VAT)
  totalRevenueWithVAT: number // ILS (including VAT)
  revenueByMonth: Array<{
    month: string // YYYY-MM
    revenue: number
    revenueWithVAT: number
  }>
  
  // Costs
  totalCosts: number // ILS
  materialCosts: number // ILS
  laborCosts: number // ILS
  otherCosts: number // ILS
  
  // Profit
  totalProfit: number // ILS
  profitMargin: number // percentage (0-100)
  profitByMonth: Array<{
    month: string // YYYY-MM
    profit: number
    margin: number
  }>
  
  // VAT
  totalVAT: number // ILS
  vatPercent: number // percentage (default: DEFAULT_VAT_PERCENT)
  
  // Cash flow
  cashFlow: Array<{
    date: string // YYYY-MM-DD
    revenue: number
    costs: number
    net: number
  }>
  
  // Projections (if available)
  projections?: {
    nextMonthRevenue: number
    nextMonthProfit: number
    growthRate: number // percentage
  }
  
  // Trends
  trends?: {
    revenueChange: number // percentage change
    profitChange: number // percentage change
    marginChange: number // percentage point change
  }
}

// ============================================================================
// Workforce Analytics
// ============================================================================

export interface WorkforceAnalyticsSummary {
  // Period information
  period: AnalyticsPeriod
  
  // Workers
  totalWorkers: number
  activeWorkers: number
  
  // Work shifts
  totalShifts: number
  totalWorkDays: number
  totalLaborCost: number // ILS
  
  // By worker
  byWorker: Array<{
    workerId: string
    workerName: string
    shiftCount: number
    totalCost: number
    averageDailyRate: number
  }>
  
  // By project
  byProject: Array<{
    projectId: string
    projectName: string
    shiftCount: number
    totalCost: number
    workerCount: number
  }>
  
  // Productivity metrics
  averageShiftsPerWorker: number
  averageCostPerShift: number
  averageCostPerProject: number
  
  // Labor cost as percentage of revenue (if revenue data available)
  laborCostPercentOfRevenue?: number
  
  // Trends
  trends?: {
    totalShiftsChange: number
    totalCostChange: number
    averageCostChange: number
  }
}

// ============================================================================
// Analytics Context (Main Type for AI)
// ============================================================================

/**
 * Complete analytics context for AI processing
 * This is the main type that will be passed to AI models.
 * It contains all aggregated data needed for AI analysis.
 * 
 * Rule: AI never accesses database directly.
 * All data comes from buildAnalyticsContext() function on the server.
 */
export interface AnalyticsContext {
  // Metadata
  mode: AnalyticsMode
  period: AnalyticsPeriod
  generatedAt: string // ISO 8601 timestamp
  timezone: typeof DEFAULT_TIMEZONE
  
  // Analytics summaries (only include relevant ones based on mode)
  leads?: LeadsAnalyticsSummary
  deals?: DealsAnalyticsSummary
  finance?: FinanceAnalyticsSummary
  workforce?: WorkforceAnalyticsSummary
  
  // Additional context for AI
  metadata?: {
    // Company/business context
    companyName?: string
    businessType?: string
    
    // User context (who requested the analysis)
    requestedBy?: string
    userRole?: string
    
    // Analysis preferences
    focusAreas?: string[] // e.g., ['conversion', 'profit', 'efficiency']
    comparisonPeriod?: AnalyticsPeriod // for trend analysis
    
    // Custom data (extensible)
    [key: string]: unknown
  }
  
  // Raw data samples (optional, for detailed analysis)
  // Keep minimal - AI should work with summaries, not raw data
  samples?: {
    recentLeads?: Array<{
      id: string
      name: string
      source: string
      status: string
      createdAt: string
    }>
    recentDeals?: Array<{
      id: string
      customerName: string
      projectType: string
      stage: string
      revenue: number
      profit: number
    }>
    recentShifts?: Array<{
      id: string
      projectId: string
      workerName: string
      date: string
      cost: number
    }>
  }
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Request parameters for building analytics context
 */
export interface BuildAnalyticsContextParams {
  mode: AnalyticsMode
  period: AnalyticsPeriod
  options?: {
    includeSamples?: boolean
    includeTrends?: boolean
    comparisonPeriod?: AnalyticsPeriod
    focusAreas?: string[]
    metadata?: Record<string, unknown>
  }
}

/**
 * Response from buildAnalyticsContext function
 */
export interface AnalyticsContextResponse {
  context: AnalyticsContext
  success: boolean
  error?: string
}

