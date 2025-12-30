import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!url || !key) {
    throw new Error('Missing Supabase credentials')
  }
  
  return createClient(url, key)
}

export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    
    // Verify JWT
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key')
    const { payload } = await jwtVerify(token, secret)
    
    const userId = payload.sub || payload.user_id
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Get all companies where user is a member
    const supabase = getSupabaseClient()
    const { data: memberships, error } = await supabase
      .from('company_members')
      .select(`
        company_id,
        role,
        companies:company_id (
          id,
          name
        )
      `)
      .eq('user_id', userId)

    if (error) {
      console.error('[Companies API] Error:', error)
      return NextResponse.json(
        { error: 'Failed to load companies' },
        { status: 500 }
      )
    }

    // Format response
    const companies = memberships.map((m: any) => ({
      id: m.company_id,
      name: m.companies?.name || 'Unknown Company',
      role: m.role,
    }))

    return NextResponse.json({ companies })
  } catch (error: any) {
    console.error('[Companies API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

