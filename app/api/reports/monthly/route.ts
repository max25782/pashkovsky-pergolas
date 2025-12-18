/**
 * API route for monthly reports
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { MonthlyReport, MonthlyReportRow } from '@/types/workers'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// GET - Monthly report
export async function GET(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') // YYYY-MM

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'month parameter is required in YYYY-MM format' },
        { status: 400 }
      )
    }

    const [year, monthNum] = month.split('-').map(Number)
    const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`
    const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0] // Last day of month

    // Get all deals created in this month
    const { data: dealsData, error: dealsError } = await supabase
      .from('deals')
      .select('id, customer_name, created_at, price, final_amount, total_amount')
      .gte('created_at', `${startDate}T00:00:00.000Z`)
      .lte('created_at', `${endDate}T23:59:59.999Z`)

    if (dealsError) {
      console.error('Error fetching deals:', dealsError)
      return NextResponse.json({ 
        error: 'Failed to fetch deals', 
        details: dealsError.message 
      }, { status: 500 })
    }

    // Get all work shifts for these projects in this month
    const dealIds = (dealsData || []).map((d: any) => d.id)
    
    let workShiftsData: any[] = []
    if (dealIds.length > 0) {
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('work_shifts')
        .select('project_id, daily_rate_snapshot, date')
        .in('project_id', dealIds)
        .gte('date', startDate)
        .lte('date', endDate)

      if (shiftsError) {
        console.error('Error fetching work shifts:', shiftsError)
        return NextResponse.json({ 
          error: 'Failed to fetch work shifts',
          details: shiftsError.message 
        }, { status: 500 })
      }

      workShiftsData = shiftsData || []
    }

    // Get offers for these deals (deal_id is TEXT, so we need to convert deal.id to string)
    const dealIdStrings = dealIds.map(id => String(id))
    let offersData: any[] = []
    
    if (dealIdStrings.length > 0) {
      const { data: offers, error: offersError } = await supabase
        .from('offers')
        .select('deal_id, final_price, created_at')
        .in('deal_id', dealIdStrings)
        .gte('created_at', `${startDate}T00:00:00.000Z`)
        .lte('created_at', `${endDate}T23:59:59.999Z`)

      if (offersError) {
        console.error('Error fetching offers:', offersError)
        // Don't fail - just log and continue without offers
        console.warn('Continuing without offers data')
      } else {
        offersData = offers || []
      }
    }

    // Calculate totals per project
    const projectMap = new Map<string, MonthlyReportRow>()

    // Process deals and offers
    for (const deal of dealsData || []) {
      const dealId = deal.id
      const dealIdString = String(dealId)
      
      // Find offers for this deal
      const dealOffers = offersData.filter((o: any) => String(o.deal_id) === dealIdString)
      
      // Get final price from latest offer or highest final_price
      let revenue = 0
      if (dealOffers.length > 0) {
        const validOffers = dealOffers.filter((o: any) => o.final_price != null && o.final_price !== '')
        if (validOffers.length > 0) {
          revenue = Math.max(...validOffers.map((o: any) => parseFloat(String(o.final_price)) || 0))
        }
      }
      
      // Also check deal.price if no offers
      if (revenue === 0) {
        // Try deal.price field
        if ((deal as any).price) {
          revenue = parseFloat(String((deal as any).price)) || 0
        }
        // Try deal.final_amount
        if (revenue === 0 && (deal as any).final_amount) {
          revenue = parseFloat(String((deal as any).final_amount)) || 0
        }
        // Try deal.total_amount
        if (revenue === 0 && (deal as any).total_amount) {
          revenue = parseFloat(String((deal as any).total_amount)) || 0
        }
      }

      // Calculate labor cost for this project
      const projectShifts = workShiftsData.filter((s: any) => s.project_id === dealId)
      const laborCost = projectShifts.reduce((sum: number, shift: any) => {
        return sum + parseFloat(shift.daily_rate_snapshot)
      }, 0)

      const profit = revenue - laborCost

      projectMap.set(dealId, {
        projectId: dealId,
        projectName: `Deal ${dealId.slice(0, 8)}`,
        customerName: deal.customer_name || 'Without name',
        revenue,
        laborCost,
        profit,
      })
    }

    // Calculate totals
    const projects = Array.from(projectMap.values())
    const totalRevenue = projects.reduce((sum, p) => sum + p.revenue, 0)
    const totalLaborCost = projects.reduce((sum, p) => sum + p.laborCost, 0)
    const totalProfit = totalRevenue - totalLaborCost

    const report: MonthlyReport = {
      month,
      totalRevenue,
      totalLaborCost,
      totalProfit,
      projects: projects.sort((a, b) => b.revenue - a.revenue), // Sort by revenue descending
    }

    // Log summary for debugging
    console.log(`[Monthly Report] Month: ${month}, Deals: ${dealsData?.length || 0}, Offers: ${offersData.length}, Projects: ${projectMap.size}`)

    return NextResponse.json({ report })
  } catch (error: any) {
    console.error('Error in GET /api/reports/monthly:', {
      error: error.message,
      stack: error.stack?.substring(0, 500),
      month,
    })
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error.message,
        month,
      },
      { status: 500 }
    )
  }
}



