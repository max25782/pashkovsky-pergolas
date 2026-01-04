import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAIDirectorAuth } from '@/lib/middleware/ai-director-auth'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY)
  : undefined

/**
 * GET /api/ai-director/data/leads
 * 
 * Provides leads data to Bedrock Agent
 * Query params:
 *   - company_id (required): Company ID for multi-tenant filtering
 *   - status: Filter by lead status
 *   - source: Filter by lead source
 *   - start_date: Filter leads created after this date (ISO 8601)
 *   - end_date: Filter leads created before this date (ISO 8601)
 *   - limit: Maximum number of leads to return (default 50, max 100)
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
    const status = searchParams.get('status')
    const source = searchParams.get('source')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    
    // Query Supabase
    let query = supabase
      .from('leads')
      // `updated_at` does NOT exist in this project schema (keep created_at only)
      .select('id, name, phone, email, source, status, notes, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (status) query = query.eq('status', status)
    if (source) query = query.eq('source', source)
    if (startDate) query = query.gte('created_at', startDate)
    if (endDate) query = query.lte('created_at', endDate)
    
    const { data, error } = await query
    
    if (error) {
      console.error('[AI Director] Error fetching leads:', error)
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
    }
    
    return NextResponse.json({ 
      leads: data || [],
      count: data?.length || 0,
    })
  } catch (error: any) {
    console.error('[AI Director] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

