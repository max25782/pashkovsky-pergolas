/**
 * API: Check SuperAdmin Phone
 * POST /api/auth/check-phone
 * Public endpoint to check if phone is registered as SuperAdmin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PlatformAdmin } from '@/types/membership'

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json()
    
    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number required' },
        { status: 400 }
      )
    }

    // Normalize phone
    const normalizedPhone = phone.trim().replace(/[\s-]/g, '')
    
    // Use service role or bypass RLS for this check
    // Since this is server-side, we can use service role
    const supabase = createClient()
    
    // Try to get admin by phone
    // Note: This might fail due to RLS, so we'll use a workaround
    const { data: adminData, error } = await supabase
      .from('platform_admins')
      .select('user_id, email')
      .eq('phone', normalizedPhone)
      .eq('is_active', true)
      .maybeSingle<Pick<PlatformAdmin, 'user_id' | 'email'>>()
    
    if (error) {
      console.error('[Check Phone] Error:', error)
      // If RLS blocks, return error
      return NextResponse.json(
        { error: 'Unable to check phone number', details: error.message },
        { status: 500 }
      )
    }
    
    if (!adminData?.email) {
      return NextResponse.json(
        { error: 'Phone number not registered as SuperAdmin' },
        { status: 404 }
      )
    }
    
    // Return email (without exposing other sensitive data)
    return NextResponse.json({
      email: adminData.email,
      exists: true
    })
  } catch (error) {
    console.error('[Check Phone] Exception:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

