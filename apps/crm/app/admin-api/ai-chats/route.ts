import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { getOwnedAiSession } from '@/lib/ai-chat/session-company'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

/**
 * Admin list/detail/delete for marketing AI chats (ai_sessions).
 * company_id always from verified auth context — never from query/body.
 * Service role is used, so every query must filter by company_id.
 */
export async function GET(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  if (!supabase) return new Response('Missing Supabase env', { status: 500 })

  const companyId = authCheck.context?.companyId
  if (!companyId) {
    return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session_id')
  const search = searchParams.get('q')?.trim() || ''
  const limit = parseInt(searchParams.get('limit') || '50', 10)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  try {
    if (sessionId) {
      const session = await getOwnedAiSession(supabase, sessionId, companyId)
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }

      const { data: messages, error: messagesError } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true })

      if (messagesError) {
        return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 })
      }

      return NextResponse.json({ session, messages })
    }

    let query = supabase
      .from('ai_sessions')
      .select('*, ai_messages(count)', { count: 'exact' })
      .eq('company_id', companyId)
      .order('last_activity', { ascending: false })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.ilike('client_id', `%${search}%`)
    }

    const { data: sessions, error, count } = await query

    if (error) {
      return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 })
    }

    const sessionsWithPreview = await Promise.all(
      (sessions || []).map(async (session: { id: string; ai_messages?: Array<{ count: number }> }) => {
        const { data: firstMessage } = await supabase
          .from('ai_messages')
          .select('content')
          .eq('session_id', session.id)
          .eq('role', 'user')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        return {
          ...session,
          message_count: session.ai_messages?.[0]?.count || 0,
          preview: firstMessage?.content?.slice(0, 100) || '',
        }
      }),
    )

    return NextResponse.json({
      sessions: sessionsWithPreview,
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('AI Chats API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  if (!supabase) return new Response('Missing Supabase env', { status: 500 })

  const companyId = authCheck.context?.companyId
  if (!companyId) {
    return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
  }

  try {
    const owned = await getOwnedAiSession(supabase, sessionId, companyId)
    if (!owned) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('ai_sessions')
      .delete()
      .eq('id', owned.id)
      .eq('company_id', companyId)

    if (error) {
      return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete session error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
