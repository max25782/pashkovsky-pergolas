import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY)
  : null

/**
 * GET /api/admin/articles
 * Fetch all articles from Supabase or return empty array
 */
export async function GET(req: NextRequest) {
  if (!supabase) {
    console.warn('[Articles API] Supabase not configured')
    return NextResponse.json({ articles: [] })
  }

  try {
    // Check if articles table exists
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === '42P01') {
        console.log('[Articles API] Table does not exist, returning empty')
        return NextResponse.json({ articles: [] })
      }
      throw error
    }

    console.log(`[Articles API] Loaded ${data?.length || 0} articles`)
    return NextResponse.json({ articles: data || [] })
  } catch (error) {
    console.error('[Articles API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to load articles', articles: [] },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/articles
 * Create or update article
 */
export async function POST(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    )
  }

  try {
    const article = await req.json()

    // If article has ID, update; otherwise insert
    if (article.id) {
      const { data, error } = await supabase
        .from('articles')
        .update(article)
        .eq('id', article.id)
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({ success: true, article: data })
    } else {
      const { data, error } = await supabase
        .from('articles')
        .insert(article)
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({ success: true, article: data })
    }
  } catch (error) {
    console.error('[Articles API] Save error:', error)
    return NextResponse.json(
      { error: 'Failed to save article' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/articles
 * Delete article by slug
 */
export async function DELETE(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    )
  }

  try {
    const { searchParams } = new URL(req.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('articles')
      .delete()
      .eq('slug', slug)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Articles API] Delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete article' },
      { status: 500 }
    )
  }
}
