/**
 * POST /api/sendPergolaConfig
 * Saves 3D configurator config + screenshot from the site
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Prefer service role; fallback to anon (RLS allows insert)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase =
  url && (serviceKey || anonKey)
    ? createClient(url, serviceKey || anonKey!, { db: { schema: 'public' } })
    : undefined

export async function POST(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const { screenshot, ...config } = body ?? {}

    if (!config || typeof config !== 'object') {
      return NextResponse.json({ error: 'Invalid config' }, { status: 400 })
    }

    const { error } = await supabase.from('pergola_config_submissions').insert({
      config: config as Record<string, unknown>,
      screenshot: typeof screenshot === 'string' ? screenshot : null,
    })

    if (error) {
      console.error('[sendPergolaConfig] Insert error:', error)
      return NextResponse.json({ error: 'Failed to save config' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[sendPergolaConfig] Error:', e)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
