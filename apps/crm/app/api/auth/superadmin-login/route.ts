import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSession } from '@/lib/session/redis-client';

export async function POST(request: NextRequest) {
  try {
    const { phone, token } = await request.json();


    // Validate input
    if (!phone || !token) {
      console.error('[SuperAdmin Login] Missing phone or token');
      return NextResponse.json(
        { error: 'Phone and token are required' },
        { status: 400 }
      );
    }

    // Validate SUPERADMIN_TOKEN
    const expectedToken = process.env.SUPERADMIN_TOKEN;

    if (!expectedToken) {
      console.error('[SuperAdmin Login] ❌ SUPERADMIN_TOKEN not configured in .env.local');
      return NextResponse.json(
        { error: 'SuperAdmin login not configured' },
        { status: 500 }
      );
    }

    if (token !== expectedToken) {
      console.warn('[SuperAdmin Login] ❌ Token mismatch');
      console.warn('[SuperAdmin Login] Expected:', expectedToken);
      console.warn('[SuperAdmin Login] Received:', token);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }


    // Normalize phone
    const normalizedPhone = phone.replace(/\D/g, '');

    // Check for SERVICE_ROLE_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('[SuperAdmin Login] ❌ SUPABASE_SERVICE_ROLE_KEY not configured in .env.local');
      return NextResponse.json(
        { error: 'SuperAdmin login not configured properly' },
        { status: 500 }
      );
    }

    // Create Supabase Admin client (bypasses RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Check if phone belongs to an active SuperAdmin
    const { data: admin, error: adminError } = await supabaseAdmin
      .from('platform_admins')
      .select('user_id, email, role, is_active')
      .eq('phone', normalizedPhone)
      .eq('is_active', true)
      .single();

    if (adminError || !admin) {
      console.warn('[SuperAdmin Login] Phone not found or inactive:', normalizedPhone);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    if (admin.role !== 'superadmin') {
      console.warn('[SuperAdmin Login] User is not a SuperAdmin:', admin.role);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }


    // Create server-side session in Redis
    const sessionId = await createSession({
      user_id: admin.user_id,
      email: admin.email,
      role: 'superadmin',
      phone: normalizedPhone,
    });


    // Create response with httpOnly cookie
    const response = NextResponse.json({
      success: true,
      message: 'Authenticated successfully',
      // Don't return sensitive data to client
    });

    // Set httpOnly cookie (NOT accessible from JavaScript)
    response.cookies.set('superadmin_session', sessionId, {
      httpOnly: true, // Critical: prevents XSS attacks
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict', // CSRF protection
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });


    return response;
  } catch (error) {
    console.error('[SuperAdmin Login] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

