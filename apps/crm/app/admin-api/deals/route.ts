import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCompanyId, getCompanyIdAsync } from '@/lib/middleware/company-context'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { logDealEvent } from '@/lib/audit/logger'

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

// GET - List all deals with filters
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
  const stage = searchParams.get('stage')?.trim() || ''
  const projectType = searchParams.get('project_type')?.trim() || ''
  const startDate = searchParams.get('start_date')?.trim() || ''
  const endDate = searchParams.get('end_date')?.trim() || ''
  const limit = Number(searchParams.get('limit') || 50)
  const offset = Number(searchParams.get('offset') || 0)

  let query = supabase
    .from('deals')
    .select('*, deal_railings_details(*)', { count: 'exact' })
    .eq('company_id', companyId) // Multi-tenant filter
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  
  // Filter by stage
  if (stage) {
    query = query.eq('stage', stage)
  }
  
  // Filter by project type
  if (projectType) {
    query = query.eq('project_type', projectType)
  }
  
  // Filter by date range
  if (startDate) {
    query = query.gte('created_at', startDate)
  }
  if (endDate) {
    query = query.lte('created_at', endDate)
  }
  
  // Search in notes, material, color_ral, customer name, phone
  if (q) {
    const like = `%${q.replace(/\s+/g, '%')}%`
    query = query.or(`notes.ilike.${like},material.ilike.${like},color_ral.ilike.${like},customer_name.ilike.${like},customer_phone.ilike.${like}`)
  }
  
  const { data, error, count } = await query
  
  if (error) {
    console.error('GET deals error:', error)
    return new Response(JSON.stringify(error), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  
  return new Response(JSON.stringify({ data: data ?? [], count: count ?? 0 }), { 
    status: 200, 
    headers: { 'Content-Type': 'application/json' } 
  })
}

// POST - Create a new deal (usually from a won lead)
export async function POST(req: NextRequest) {
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
    console.error('POST: Bad JSON', e)
    return new Response('Bad JSON', { status: 400 })
  }
  
  const { lead_id, work_type, meters_total, height_cm, profile_type, color, location_type, glass_type, railings_notes, ...dealData } = body || {}
  
  const effectiveWorkType = work_type || 'pergola'
  dealData.work_type = effectiveWorkType
  
  if (effectiveWorkType === 'railings') {
    if (!meters_total || Number(meters_total) <= 0) {
      return new Response(JSON.stringify({ error: 'meters_total is required and must be > 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }
    if (!profile_type || String(profile_type).trim() === '') {
      return new Response(JSON.stringify({ error: 'profile_type is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }
    if (!color || String(color).trim() === '') {
      return new Response(JSON.stringify({ error: 'color is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }
    if (!location_type || String(location_type).trim() === '') {
      return new Response(JSON.stringify({ error: 'location_type is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }
  }
  
  // If lead_id is provided, fetch lead data to populate deal
  if (lead_id) {
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single()
    
    if (!leadError && lead) {
      // Populate deal with lead data
      dealData.customer_name = dealData.customer_name || lead.name
      dealData.customer_phone = dealData.customer_phone || lead.phone
      dealData.source = dealData.source || lead.source
      dealData.lead_id = lead_id
      
      // Extract email and city from notes if available
      if (lead.notes) {
        const notes = lead.notes
        const emailMatch = notes.match(/Email:\s*([^\n]+)/i)
        if (emailMatch && !dealData.customer_email) {
          dealData.customer_email = emailMatch[1].trim()
        }
        if (!emailMatch && !dealData.customer_city) {
          dealData.customer_city = notes.split('\n')[0].trim()
        }
      }
    }
  }
  
  // Set defaults
  if (!dealData.deal_status) dealData.deal_status = 'in_progress'
  if (!dealData.currency) dealData.currency = 'ILS'
  
  // Add company_id to deal data
  const dealDataWithCompany = {
    ...dealData,
    company_id: companyId
  }
  
  const { data, error } = await supabase
    .from('deals')
    .insert(dealDataWithCompany)
    .select()
    .single()
  
  if (error) {
    console.error('POST: Supabase error', error)
    await logDealEvent(req, 'create', undefined, dealData, 'error')
    return new Response(JSON.stringify({ error: error.message, code: error.code, details: error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  if (effectiveWorkType === 'railings') {
    const { error: railingsError } = await supabase
      .from('deal_railings_details')
      .insert({
        deal_id: data.id,
        company_id: companyId,
        meters_total: Number(meters_total),
        height_cm: height_cm != null ? Number(height_cm) : null,
        profile_type: String(profile_type).trim(),
        color: String(color).trim(),
        location_type: String(location_type).trim() as 'balcony' | 'stairs' | 'roof' | 'yard' | 'other',
        glass_type: glass_type != null ? String(glass_type).trim() : null,
        notes: railings_notes != null ? String(railings_notes).trim() : null,
      })
    if (railingsError) {
      console.error('POST: Railings insert error', railingsError)
      await supabase.from('deals').delete().eq('id', data.id)
      return new Response(JSON.stringify({ error: railingsError.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    const { data: railingsRow } = await supabase
      .from('deal_railings_details')
      .select('*')
      .eq('deal_id', data.id)
      .single()
    return new Response(JSON.stringify({ ...data, deal_railings_details: railingsRow }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  // Log successful creation
  await logDealEvent(req, 'create', data.id, dealData, 'success')
  
  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  })
}

// PATCH - Update a deal
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
  
  const { id, meters_total, height_cm, profile_type, color, location_type, glass_type, railings_notes, ...updates } = body || {}
  if (!id) {
    return new Response('Missing id', { status: 400 })
  }
  
  const railingsUpdates = { meters_total, height_cm, profile_type, color, location_type, glass_type, railings_notes }
  const hasRailingsUpdates = Object.values(railingsUpdates).some(v => v !== undefined)
  
  // Проверяем, что есть что обновлять
  if (Object.keys(updates).length === 0 && !hasRailingsUpdates) {
    // Если нет обновлений, просто возвращаем текущую сделку
    const { data: currentDeal, error: fetchError } = await supabase
      .from('deals')
      .select('*')
      .eq('id', id)
      .single()
    
    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify(currentDeal), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  // Convert empty strings to null for optional fields
  Object.keys(updates).forEach(key => {
    if (updates[key] === '') updates[key] = null
  })
  
  
  // Сначала проверяем, существует ли сделка
  const { data: existingDeal, error: checkError } = await supabase
    .from('deals')
    .select('id')
    .eq('id', id)
    .single()
  
  if (checkError || !existingDeal) {
    console.error('PATCH: Deal not found', checkError)
    return new Response(JSON.stringify({ error: 'Deal not found', code: 'NOT_FOUND' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  if (hasRailingsUpdates) {
    const { data: existingDeal } = await supabase
      .from('deals')
      .select('work_type')
      .eq('id', id)
      .eq('company_id', companyId)
      .single()
    const effectiveWorkType = updates.work_type ?? existingDeal?.work_type
    if (effectiveWorkType === 'railings') {
      const railingsPayload: Record<string, unknown> = {}
      if (meters_total != null) {
        const v = Number(meters_total)
        if (v <= 0) {
          return new Response(JSON.stringify({ error: 'meters_total must be > 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
        }
        railingsPayload.meters_total = v
      }
      if (height_cm != null) railingsPayload.height_cm = Number(height_cm)
      if (profile_type != null) railingsPayload.profile_type = String(profile_type).trim()
      if (color != null) railingsPayload.color = String(color).trim()
      if (location_type != null) railingsPayload.location_type = String(location_type).trim()
      if (glass_type != null) railingsPayload.glass_type = String(glass_type).trim() || null
      if (railings_notes !== undefined) railingsPayload.notes = railings_notes != null ? String(railings_notes).trim() : null
      if (Object.keys(railingsPayload).length > 0) {
        const { data: existingRailings } = await supabase
          .from('deal_railings_details')
          .select('deal_id')
          .eq('deal_id', id)
          .single()
        if (existingRailings) {
          await supabase
            .from('deal_railings_details')
            .update(railingsPayload)
            .eq('deal_id', id)
        } else {
          const { data: dealRow } = await supabase.from('deals').select('id').eq('id', id).single()
          if (dealRow && railingsPayload.meters_total && railingsPayload.profile_type && railingsPayload.color && railingsPayload.location_type) {
            await supabase.from('deal_railings_details').insert({
              deal_id: id,
              company_id: companyId,
              meters_total: railingsPayload.meters_total,
              height_cm: railingsPayload.height_cm ?? null,
              profile_type: railingsPayload.profile_type,
              color: railingsPayload.color,
              location_type: railingsPayload.location_type,
              glass_type: railingsPayload.glass_type ?? null,
              notes: railingsPayload.notes ?? null,
            })
          }
        }
      }
    }
  }
  
  // When moving to completed: auto-set installation_date if empty (server time)
  if (updates.stage === 'done') {
    const { data: current } = await supabase
      .from('deals')
      .select('installation_date')
      .eq('id', id)
      .eq('company_id', companyId)
      .single()
    if (current?.installation_date == null) {
      updates.installation_date = new Date().toISOString()
    }
  }
  
  const { data, error } = await supabase
    .from('deals')
    .update(Object.keys(updates).length > 0 ? updates : { updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', companyId) // Multi-tenant: ensure same company
    .select()
    .single()
  
  if (error) {
    console.error('PATCH: Supabase error', error)
    await logDealEvent(req, 'update', id, updates, 'error')
    return new Response(JSON.stringify({ error: error.message, code: error.code, details: error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  if (!data) {
    console.error('PATCH: No data returned after update')
    // Если обновление прошло, но данных нет, попробуем получить обновленную сделку
    const { data: updatedDeal, error: fetchError } = await supabase
      .from('deals')
      .select('*')
      .eq('id', id)
      .single()
    
    if (fetchError || !updatedDeal) {
      return new Response(JSON.stringify({ error: 'Update succeeded but could not fetch updated deal' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify(updatedDeal), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  
  // Log successful update
  await logDealEvent(req, 'update', data.id, updates, 'success')
  
  if (data.work_type === 'railings') {
    const { data: railingsRow } = await supabase
      .from('deal_railings_details')
      .select('*')
      .eq('deal_id', data.id)
      .single()
    return new Response(JSON.stringify({ ...data, deal_railings_details: railingsRow }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

// DELETE - Delete a deal
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
  
  if (!id) {
    return new Response('Missing id', { status: 400 })
  }
  
  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId) // Multi-tenant: ensure same company
  
  if (error) {
    console.error('DELETE: Supabase error', error)
    await logDealEvent(req, 'delete', id, undefined, 'error')
    return new Response(JSON.stringify(error), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  
  // Log successful deletion
  await logDealEvent(req, 'delete', id, undefined, 'success')
  
  return new Response('OK', { status: 200 })
}

