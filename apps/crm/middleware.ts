import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/reset-password',
  '/verify-email',
  '/auth/callback',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Skip middleware for static files, API routes, and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/admin-api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // Files with extensions
  ) {
    return NextResponse.next()
  }
  
  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`))) {
    return NextResponse.next()
  }
  
  // Create Supabase client for middleware
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // NOTE: Auth check disabled in middleware due to Supabase SSR cookie issues
  // Client-side pages (like AdminPage) handle auth checks and redirects
  // This is a known issue with Next.js middleware and Supabase Auth cookies
  if (pathname.startsWith('/app')) {
    // Just pass through - let client-side handle auth
    return NextResponse.next()
  }
  
  // Root redirect to /app (not /app/admin)
  if (pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/app'
    return NextResponse.redirect(url)
  }
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api|admin-api).*)',
  ],
}
