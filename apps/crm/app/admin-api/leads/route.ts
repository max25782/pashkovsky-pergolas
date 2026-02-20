import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCompanyId, getCompanyIdAsync } from '@/lib/middleware/company-context'
import { requireAuthAsync } from '@/lib/middleware/auth-async'

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

export async function GET(req: NextRequest) {
  // Check authentication (JWT or admin token)
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error
  
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })
  
  // Multi-tenant: Get company_id (sync for custom JWT, async for Supabase Auth)
  const companyId = getCompanyId(req) ?? (await getCompanyIdAsync(req)) ?? authCheck.context.companyId ?? null
  if (!companyId) return new Response('Unauthorized: No company context', { status: 401 })
  
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() || ''
  const source = searchParams.get('source')?.trim() || '' // Filter by source/campaign
  const status = searchParams.get('status')?.trim() || '' // Filter by status
  const startDate = searchParams.get('start_date')?.trim() || '' // Filter by start date
  const endDate = searchParams.get('end_date')?.trim() || '' // Filter by end date
  const limit = Number(searchParams.get('limit') || 20)
  const offset = Number(searchParams.get('offset') || 0)

  let query = supabase.from('leads').select('*', { count: 'exact' })
    .eq('company_id', companyId) // Multi-tenant filter
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
  
  const { data, error } = await query
  if (error) return new Response(JSON.stringify(error), { status: 400 })
  
  return new Response(JSON.stringify(data ?? []), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

export async function PATCH(req: NextRequest) {
  // Check authentication (JWT or admin token)
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error
  
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })
  
  // Multi-tenant: Get company_id (sync for custom JWT, async for Supabase Auth)
  const companyId = getCompanyId(req) ?? (await getCompanyIdAsync(req)) ?? authCheck.context.companyId ?? null
  if (!companyId) return new Response('Unauthorized: No company context', { status: 401 })
  
  let body: any
  try { 
    body = await req.json() 
  } catch (e) { 
    console.error('PATCH: Bad JSON', e)
    return new Response('Bad JSON', { status: 400 }) 
  }
  
  const { id, ...updates } = body || {}
  if (!id) {
    console.error('PATCH: Missing id')
    return new Response('Missing id', { status: 400 })
  }
  
  // Convert empty string to null for status and notes
  if (updates.status === '') updates.status = null
  if (updates.notes === '') updates.notes = null
  
  console.log('PATCH: Updating lead', id, 'with', updates)
  
  // First, get the current lead to check if status is changing to 'won'
  const { data: currentLead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()
  
  const isChangingToWon = updates.status === 'won' && currentLead?.status !== 'won'
  
  // Update the lead
  const { data, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id)
    .eq('company_id', companyId) // Multi-tenant: ensure same company
    .select()
    .single()
  
  if (error) {
    console.error('PATCH: Supabase error', error)
    // Provide more helpful error message for constraint violations
    let errorMessage = error.message
    if (error.code === '23514' && error.message.includes('status_check')) {
      errorMessage = 'Недопустимое значение статуса. Разрешенные значения: pending, confirmed, contacted, qualified, won, lost (или null)'
    }
    return new Response(JSON.stringify({ error: errorMessage, code: error.code, details: error }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  // If status changed to 'won', automatically create a deal
  if (isChangingToWon && data) {
    try {
      // Create deal from lead
      const dealData = {
        lead_id: data.id,
        customer_name: data.name,
        customer_phone: data.phone,
        stage: 'new',
        notes: `Создано из лида #${data.id}\n${data.notes || ''}`,
      }
      
      const { data: newDeal, error: dealError } = await supabase
        .from('deals')
        .insert(dealData)
        .select()
        .single()
      
      if (dealError) {
        console.error('Failed to create deal from won lead:', dealError)
        // Don't fail the lead update, just log the error
      } else {
        console.log('Successfully created deal from won lead:', newDeal?.id)
      }
    } catch (dealErr) {
      console.error('Error creating deal from won lead:', dealErr)
      // Don't fail the lead update
    }
  }
  
  console.log('PATCH: Successfully updated', data)
  return new Response(JSON.stringify(data), { 
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function DELETE(req: NextRequest) {
  // Check authentication (JWT or admin token)
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error
  
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })
  
  // Multi-tenant: Get company_id (sync for custom JWT, async for Supabase Auth)
  const companyId = getCompanyId(req) ?? (await getCompanyIdAsync(req)) ?? authCheck.context.companyId ?? null
  if (!companyId) return new Response('Unauthorized: No company context', { status: 401 })
  
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return new Response('Missing id', { status: 400 })
  
  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId) // Multi-tenant: ensure same company
  
  if (error) return new Response(JSON.stringify(error), { status: 400 })
  return new Response('OK')
}








