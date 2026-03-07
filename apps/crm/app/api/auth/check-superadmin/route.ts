/**
 * Check if current user is SuperAdmin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'

// Force dynamic rendering (uses cookies)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ isSuperAdmin: false })
    }

    const isAdmin = await isSuperAdmin(user.id)

    return NextResponse.json({ 
      isSuperAdmin: isAdmin,
      userId: user.id 
    })
  } catch (error) {
    console.error('[Check SuperAdmin] Error:', error)
    return NextResponse.json({ isSuperAdmin: false })
  }
}

