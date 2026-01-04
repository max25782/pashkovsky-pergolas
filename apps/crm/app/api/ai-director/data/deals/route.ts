import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAIDirectorAuth } from '@/lib/middleware/ai-director-auth'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY)
  : undefined

/**
 * GET /api/ai-director/data/deals
 * 
 * Provides deals data to Bedrock Agent
 * Query params:
 *   - company_id (required): Company ID for multi-tenant filtering
 *   - stage: Filter by deal stage (new, measure, offer, offer_approved, material_ordered, approved, production, install, done)
 *   - status: Backward-compatible alias for stage. Also supports status=open (means stage != done)
 *   - start_date: Filter deals created after this date (ISO 8601)
 *   - end_date: Filter deals created before this date (ISO 8601)
 *   - limit: Maximum number of deals to return (default 50, max 100)
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
    
    // company_id is required and passed from main API
    const companyId = searchParams.get('company_id')
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 })
    }
    
    // Filters
    const stageOrStatus = (searchParams.get('stage') || searchParams.get('status') || '').trim()
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    
    // Query Supabase
    let query = supabase
      .from('deals')
      .select('id, customer_name, customer_phone, customer_email, stage, project_type, price, my_cost, notes, created_at, updated_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    // stage filter (DB column is `stage`, not `status`)
    // - status=open: treat as "not completed"
    if (stageOrStatus) {
      if (stageOrStatus === 'open') {
        query = query.neq('stage', 'done')
      } else {
        query = query.eq('stage', stageOrStatus)
      }
    }
    if (startDate) query = query.gte('created_at', startDate)
    if (endDate) query = query.lte('created_at', endDate)
    
    const { data, error } = await query
    
    if (error) {
      console.error('[AI Director] Error fetching deals:', error)
      return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 })
    }
    
    return NextResponse.json({ 
      deals: data || [],
      count: data?.length || 0,
    })
  } catch (error: any) {
    console.error('[AI Director] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

