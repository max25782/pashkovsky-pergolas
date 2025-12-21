import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { defaultLocale, locales } from '@/lib/locales'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') || ''
  const subdomain = hostname.split('.')[0]
  
  // Check if CRM is enabled (via environment variable)
  // Set ENABLE_CRM_SUBDOMAIN=true in .env.local for development
  // Leave it unset or false in production
  const isCRMEnabled = process.env.ENABLE_CRM_SUBDOMAIN === 'true' || 
                       process.env.NODE_ENV !== 'production'
  
  // CRM subdomain handling
  // If accessing crm/admin subdomain, always enable CRM (regardless of environment)
  // This allows CRM to work on subdomain even in production
  const isCRMSubdomain = subdomain === 'crm' || subdomain === 'admin'
  
  // Handle CRM subdomain - redirect to /app routes
  if (isCRMSubdomain) {
    // If accessing root, redirect to /app (CRM dashboard)
    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = `/app/admin`
      return NextResponse.redirect(url)
    }
    
    // Allow /app routes (CRM)
    if (pathname.startsWith('/app')) {
      return NextResponse.next()
    }
    
    // Redirect ALL non-app routes to CRM dashboard
    if (!pathname.startsWith('/api') && !pathname.startsWith('/_next')) {
      const url = request.nextUrl.clone()
      url.pathname = `/app/admin`
      return NextResponse.redirect(url)
    }
    
    return NextResponse.next()
  }
  
  // Protection: Block /app routes on main domain (CRM only)
  // Require authentication for CRM routes
  if (pathname.startsWith('/app')) {
    // Check for auth token (simplified - in production use proper auth)
    const token = request.cookies.get('token') || request.headers.get('authorization')
    
    if (!token) {
      // Redirect to login
      const url = request.nextUrl.clone()
      url.pathname = `/login`
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
    
    return NextResponse.next()
  }
  
  // Auth routes: /login, /register, etc. - no locale prefix
  if (pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/reset-password') || pathname.startsWith('/verify-email')) {
    return NextResponse.next()
  }
  
  // Original locale handling for public pages
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) return NextResponse.next()

  // Redirect to default locale for public pages
  const url = request.nextUrl.clone()
  url.pathname = `/${defaultLocale}${pathname}`
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next|api|admin-api|images|.*\\..*).*)'],
}

