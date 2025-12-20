import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

// GET - List all AI chat sessions with messages
export async function GET(req: NextRequest) {
  if (!auth(req)) return new Response('Unauthorized', { status: 401 })
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })
  
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session_id')
  const search = searchParams.get('q')?.trim() || ''
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')
  
  try {
    // If session_id provided, get messages for that session
    if (sessionId) {
      const { data: session, error: sessionError } = await supabase
        .from('ai_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()
      
      if (sessionError) {
        return Response.json({ error: 'Session not found' }, { status: 404 })
      }
      
      const { data: messages, error: messagesError } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
      
      if (messagesError) {
        return Response.json({ error: messagesError.message }, { status: 500 })
      }
      
      return Response.json({ session, messages })
    }
    
    // List all sessions with message count
    let query = supabase
      .from('ai_sessions')
      .select('*, ai_messages(count)', { count: 'exact' })
      .order('last_activity', { ascending: false })
      .range(offset, offset + limit - 1)
    
    // Search by client_id
    if (search) {
      query = query.ilike('client_id', `%${search}%`)
    }
    
    const { data: sessions, error, count } = await query
    
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    
    // Get first message for each session (preview)
    const sessionsWithPreview = await Promise.all(
      (sessions || []).map(async (session: any) => {
        const { data: firstMessage } = await supabase
          .from('ai_messages')
          .select('content')
          .eq('session_id', session.id)
          .eq('role', 'user')
          .order('created_at', { ascending: true })
          .limit(1)
          .single()
        
        return {
          ...session,
          message_count: session.ai_messages?.[0]?.count || 0,
          preview: firstMessage?.content?.slice(0, 100) || '',
        }
      })
    )
    
    return Response.json({
      sessions: sessionsWithPreview,
      total: count || 0,
      limit,
      offset,
    })
    
  } catch (error) {
    console.error('AI Chats API error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete a session and its messages
export async function DELETE(req: NextRequest) {
  if (!auth(req)) return new Response('Unauthorized', { status: 401 })
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })
  
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session_id')
  
  if (!sessionId) {
    return Response.json({ error: 'session_id is required' }, { status: 400 })
  }
  
  try {
    // Messages will be deleted automatically due to CASCADE
    const { error } = await supabase
      .from('ai_sessions')
      .delete()
      .eq('id', sessionId)
    
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    
    return Response.json({ success: true })
    
  } catch (error) {
    console.error('Delete session error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}






