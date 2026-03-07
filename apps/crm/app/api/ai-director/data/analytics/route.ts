import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAIDirectorAuth } from '@/lib/middleware/ai-director-auth'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY)
  : undefined

/**
 * GET /api/ai-director/data/analytics
 * 
 * Provides aggregated analytics data to Bedrock Agent
 * Query params:
 *   - company_id (required): Company ID for multi-tenant filtering
 *   - period: Time period (week, month, quarter, year)
 *   - start_date: Start date for custom period (ISO 8601)
 *   - end_date: End date for custom period (ISO 8601)
 */
export async function GET(req: NextRequest) {
  // Verify AI Director token
  const authError = requireAIDirectorAuth(req)
  if (authError) return authError
  
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }
  
  try {
    const { searchParams } = new URL(req.url)
    
    // company_id is required
    const companyId = searchParams.get('company_id')
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 })
    }
    
    // Determine date range
    const period = searchParams.get('period') || 'month'
    let startDate = searchParams.get('start_date')
    let endDate = searchParams.get('end_date')
    
    if (!startDate || !endDate) {
      const now = new Date()
      endDate = now.toISOString()
      
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
          break
        case 'quarter':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
          break
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()
          break
        case 'all':
        case 'all_time':
        case 'alltime':
          // For "all time", use a date far in the past (10 years ago)
          startDate = new Date(now.getTime() - 10 * 365 * 24 * 60 * 60 * 1000).toISOString()
          break
        case 'month':
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
          break
      }
    }
    
    // Fetch deals (use 'stage' not 'status')
    const { data: deals } = await supabase
      .from('deals')
      .select('id, stage, price, my_cost, created_at')
      .eq('company_id', companyId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
    
    // Fetch approved offers (REVENUE = approved offers final_price)
    const { data: approvedOffers } = await supabase
      .from('offers')
      .select('id, deal_id, final_price, approved_at, created_at')
      .eq('company_id', companyId)
      .eq('approved', true)
      .gte('approved_at', startDate)
      .lte('approved_at', endDate)
    
    // Fetch leads
    const { data: leads } = await supabase
      .from('leads')
      .select('id, status, source, created_at')
      .eq('company_id', companyId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
    
    // Calculate REVENUE from approved offers
    const revenueFromOffers = approvedOffers?.reduce((sum, offer) => {
      return sum + (parseFloat(offer.final_price?.toString() || '0') || 0)
    }, 0) || 0
    
    // Calculate REVENUE from completed deals (fallback if no approved offers)
    const revenueFromDeals = deals
      ?.filter(d => d.stage === 'done')
      .reduce((sum, deal) => {
        return sum + (parseFloat(deal.price?.toString() || '0') || 0)
      }, 0) || 0
    
    // Total revenue (prefer offers, fallback to deals)
    const totalRevenue = revenueFromOffers > 0 ? revenueFromOffers : revenueFromDeals
    
    // Aggregate deals data
    const dealsData = {
      total: deals?.length || 0,
      byStage: {} as Record<string, number>,
      totalValue: deals?.reduce((sum, d) => sum + (parseFloat(d.price?.toString() || '0') || 0), 0) || 0,
      avgValue: 0,
      completed: deals?.filter(d => d.stage === 'done').length || 0,
      totalCost: deals?.reduce((sum, d) => sum + (parseFloat(d.my_cost?.toString() || '0') || 0), 0) || 0,
    }
    
    deals?.forEach((deal) => {
      dealsData.byStage[deal.stage] = (dealsData.byStage[deal.stage] || 0) + 1
    })
    
    dealsData.avgValue = dealsData.total > 0 ? dealsData.totalValue / dealsData.total : 0
    
    // Aggregate leads data
    const leadsData = {
      total: leads?.length || 0,
      byStatus: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
      conversionRate: 0,
    }
    
    leads?.forEach((lead) => {
      leadsData.byStatus[lead.status] = (leadsData.byStatus[lead.status] || 0) + 1
      leadsData.bySource[lead.source] = (leadsData.bySource[lead.source] || 0) + 1
    })
    
    // Calculate conversion rate (leads converted to deals)
    const convertedLeads = leads?.filter(l => l.status === 'converted').length || 0
    leadsData.conversionRate = leadsData.total > 0 ? (convertedLeads / leadsData.total) * 100 : 0
    
    return NextResponse.json({ 
      period: {
        start: startDate,
        end: endDate,
        type: period,
      },
      revenue: {
        total: totalRevenue,
        from_offers: revenueFromOffers,
        from_deals: revenueFromDeals,
        approved_offers_count: approvedOffers?.length || 0,
        completed_deals_count: dealsData.completed,
      },
      deals: dealsData,
      leads: leadsData,
    })
  } catch (error) {
    console.error('[AI Director] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


