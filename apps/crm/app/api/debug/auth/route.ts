import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  return NextResponse.json({
    authenticated: !!user,
    userId: user?.id,
    email: user?.email,
    error: error?.message,
    hasCookies: !!user,
    timestamp: new Date().toISOString()
  })
}

