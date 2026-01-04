/**
 * Generate Magic Link for User
 * Quick API endpoint to generate magic login link
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const { email } = await req.json()

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  try {
    // Use environment variable for redirect URL, fallback to localhost for development
    const baseUrl = process.env.NEXT_PUBLIC_CRM_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
    const redirectUrl = `${baseUrl}/app/admin`

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: redirectUrl,
      },
    })

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Failed to generate link' }, { status: 500 })
    }

    return NextResponse.json({
      magic_link: data.properties.action_link,
      email: email,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

