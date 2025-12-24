import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { defaultLocale, locales } from '@/lib/locales'
import { jwtVerify } from 'jose'

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/reset-password',
  '/verify-email',
]

// Public routes with locale prefix (for public site)
const isPublicRoute = (pathname: string) => {
  // Check exact public routes
  if (PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`))) {
    return true
  }
  
  // Check locale-prefixed public routes
  for (const locale of locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return true
    }
  }
  
  return false
}

// Verify JWT token and extract company_id
async function verifyAuth(request: NextRequest) {
  try {
    // Try to get JWT token from cookie or Authorization header
    const tokenFromCookie = request.cookies.get('token')?.value
    const authHeader = request.headers.get('authorization')
    const tokenFromHeader = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null
    
    const token = tokenFromCookie || tokenFromHeader
    
    if (!token) {
      return { authenticated: false, userId: null, companyId: null }
    }

    // Verify JWT token
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key')
    const { payload } = await jwtVerify(token, secret)
    
    // Extract user_id and company_id from token
    const userId = payload.sub || payload.user_id
    const companyId = payload.company_id || null
    
    return {
      authenticated: true,
      userId,
      companyId: companyId as string | null,
    }
  } catch (error) {
    // Token is invalid or expired
    console.error('[Middleware] Auth error:', error)
    return { authenticated: false, userId: null, companyId: null }
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') || ''
  const subdomain = hostname.split('.')[0]
  
  // ===== PROTECT ALL /app/** ROUTES FIRST (before locale handling) =====
  if (pathname.startsWith('/app')) {
    // SKIP middleware auth check for /app routes
    // Admin token is stored in localStorage (not accessible in middleware)
    // Client-side pages will handle auth check and redirect if needed
    return NextResponse.next()
  }
  
  // CRM subdomain handling
  const isCRMSubdomain = subdomain === 'crm' || subdomain === 'admin'
  
  if (isCRMSubdomain) {
    // If accessing root, redirect to /app (CRM dashboard)
    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = `/app/admin`
      return NextResponse.redirect(url)
    }
    
    // Redirect non-app, non-api routes to CRM dashboard
    if (!pathname.startsWith('/api') && !pathname.startsWith('/_next')) {
      const url = request.nextUrl.clone()
      url.pathname = `/app/admin`
      return NextResponse.redirect(url)
    }
    
    return NextResponse.next()
  }
  
  // ===== AUTH ROUTES (public, no locale) =====
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }
  
  // ===== LOCALE HANDLING FOR PUBLIC PAGES ONLY =====
  // Skip locale redirect for API routes, static files, and CRM subdomain
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || isCRMSubdomain) {
    return NextResponse.next()
  }
  
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) {
    return NextResponse.next()
  }

  // Redirect to default locale for public pages ONLY
  const url = request.nextUrl.clone()
  url.pathname = `/${defaultLocale}${pathname}`
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next|api|admin-api|images|.*\\..*).*)'],
}

