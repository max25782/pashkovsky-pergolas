import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function auth(req: NextRequest) {
  const token = req.headers.get('x-smm-token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const expected = process.env.SMM_TOKEN || process.env.ADMIN_TOKEN // Fallback to ADMIN_TOKEN if SMM_TOKEN not set
  return !!expected && token === expected
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// GET only - read-only access for SMM
export async function GET(req: NextRequest) {
  if (!auth(req)) return new Response('Unauthorized', { status: 401 })
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })
  
  const { searchParams } = new URL(req.url)
  const source = searchParams.get('source')?.trim() || '' // Filter by source/campaign
  const status = searchParams.get('status')?.trim() || '' // Filter by status
  const startDate = searchParams.get('start_date')?.trim() || '' // Filter by start date
  const endDate = searchParams.get('end_date')?.trim() || '' // Filter by end date
  const q = searchParams.get('q')?.trim() || '' // Search
  const limit = Number(searchParams.get('limit') || 100) // Default 100 for SMM
  const offset = Number(searchParams.get('offset') || 0)

  let query = supabase
    .from('leads')
    .select('id, name, phone, source, status, notes, created_at', { count: 'exact' }) // Only selected fields
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  
  // Filter by source (campaign)
  if (source) {
    query = query.eq('source', source)
  }
  
  // Filter by status
  if (status) {
    query = query.eq('status', status)
  }
  
  // Filter by date range
  if (startDate) {
    query = query.gte('created_at', startDate)
  }
  if (endDate) {
    query = query.lte('created_at', endDate)
  }
  
  // Search in name, phone, notes
  if (q) {
    const like = `%${q.replace(/\s+/g, '%')}%`
    query = query.or(`name.ilike.${like},phone.ilike.${like},notes.ilike.${like}`)
  }
  
  const { data, error, count } = await query
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  return new Response(JSON.stringify({ 
    data: data ?? [], 
    count: count ?? 0,
    limit,
    offset 
  }), { 
    status: 200, 
    headers: { 'Content-Type': 'application/json' } 
  })
}

