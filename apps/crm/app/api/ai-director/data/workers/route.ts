import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAIDirectorAuth } from '@/lib/middleware/ai-director-auth'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY)
  : undefined

/**
 * GET /api/ai-director/data/workers
 * 
 * Provides workers and work shifts data to Bedrock Agent
 * Query params:
 *   - company_id (required): Company ID for multi-tenant filtering
 *   - include_shifts: Include work shifts data (true/false)
 *   - start_date: Filter work shifts after this date (ISO 8601)
 *   - end_date: Filter work shifts before this date (ISO 8601)
 *   - limit: Maximum number of workers to return (default 50, max 100)
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
    
    // Filters
    const includeShifts = searchParams.get('include_shifts') === 'true'
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    
    // Query workers
    const { data: workers, error: workersError } = await supabase
      .from('workers')
      // `email` does NOT exist in this project schema
      .select('id, first_name, last_name, phone, role, daily_rate, is_active, created_at, updated_at')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('first_name', { ascending: true })
      .limit(limit)
    
    if (workersError) {
      console.error('[AI Director] Error fetching workers:', workersError)
      return NextResponse.json({ error: 'Failed to fetch workers' }, { status: 500 })
    }
    
    let workShifts = null
    
    // Optionally include work shifts
    if (includeShifts && workers && workers.length > 0) {
      let shiftsQuery = supabase
        .from('work_shifts')
        .select('id, worker_id, deal_id, date, hours_worked, created_at')
        .eq('company_id', companyId)
        .order('date', { ascending: false })
        .limit(200)
      
      if (startDate) shiftsQuery = shiftsQuery.gte('date', startDate)
      if (endDate) shiftsQuery = shiftsQuery.lte('date', endDate)
      
      const { data: shifts, error: shiftsError } = await shiftsQuery
      
      if (!shiftsError) {
        workShifts = shifts
      }
    }
    
    return NextResponse.json({ 
      workers: workers || [],
      work_shifts: workShifts,
      count: workers?.length || 0,
    })
  } catch (error) {
    console.error('[AI Director] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


