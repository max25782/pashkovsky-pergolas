import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

function auth(req: NextRequest) {
  const token = req.headers.get('x-admin-token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const expected = process.env.ADMIN_TOKEN
  return !!expected && token === expected
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// GET - List all deals with filters
export async function GET(req: NextRequest) {
  if (!auth(req)) return new Response('Unauthorized', { status: 401 })
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })
  
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
    .select('*', { count: 'exact' })
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
  if (!auth(req)) return new Response('Unauthorized', { status: 401 })
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })
  
  let body: any
  try {
    body = await req.json()
  } catch (e) {
    console.error('POST: Bad JSON', e)
    return new Response('Bad JSON', { status: 400 })
  }
  
  const { lead_id, ...dealData } = body || {}
  
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
  
  const { data, error } = await supabase
    .from('deals')
    .insert(dealData)
    .select()
    .single()
  
  if (error) {
    console.error('POST: Supabase error', error)
    return new Response(JSON.stringify({ error: error.message, code: error.code, details: error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  })
}

// PATCH - Update a deal
export async function PATCH(req: NextRequest) {
  if (!auth(req)) return new Response('Unauthorized', { status: 401 })
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })
  
  let body: any
  try {
    body = await req.json()
  } catch (e) {
    console.error('PATCH: Bad JSON', e)
    return new Response('Bad JSON', { status: 400 })
  }
  
  const { id, ...updates } = body || {}
  if (!id) {
    return new Response('Missing id', { status: 400 })
  }
  
  // Проверяем, что есть что обновлять
  if (Object.keys(updates).length === 0) {
    console.log('PATCH: No updates provided, fetching current deal')
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
  
  console.log('PATCH: Updating deal', id, 'with updates:', updates)
  
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
  
  const { data, error } = await supabase
    .from('deals')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) {
    console.error('PATCH: Supabase error', error)
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
  
  console.log('PATCH: Success, returning data:', data)
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

// DELETE - Delete a deal
export async function DELETE(req: NextRequest) {
  if (!auth(req)) return new Response('Unauthorized', { status: 401 })
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })
  
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  
  if (!id) {
    return new Response('Missing id', { status: 400 })
  }
  
  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', id)
  
  if (error) {
    console.error('DELETE: Supabase error', error)
    return new Response(JSON.stringify(error), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  
  return new Response('OK', { status: 200 })
}

