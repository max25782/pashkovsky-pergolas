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
    // Try to get token from cookie or Authorization header
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
  
  // CRM subdomain handling
  const isCRMSubdomain = subdomain === 'crm' || subdomain === 'admin'
  
  if (isCRMSubdomain) {
    // If accessing root, redirect to /app (CRM dashboard)
    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = `/app/admin`
      return NextResponse.redirect(url)
    }
    
    // Allow /app routes (will be protected below)
    if (pathname.startsWith('/app')) {
      // Continue to CRM protection logic below
    } else if (!pathname.startsWith('/api') && !pathname.startsWith('/_next')) {
      // Redirect non-app routes to CRM dashboard
      const url = request.nextUrl.clone()
      url.pathname = `/app/admin`
      return NextResponse.redirect(url)
    } else {
      return NextResponse.next()
    }
  }
  
  // ===== PROTECT ALL /app/** ROUTES =====
  if (pathname.startsWith('/app')) {
    // Allow /app/select-company without company check
    if (pathname === '/app/select-company' || pathname.startsWith('/app/select-company/')) {
      const auth = await verifyAuth(request)
      
      if (!auth.authenticated) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('redirect', pathname)
        return NextResponse.redirect(url)
      }
      
      // Allow access to select-company page
      return NextResponse.next()
    }
    
    // Check authentication
    const auth = await verifyAuth(request)
    
    if (!auth.authenticated) {
      // No valid session - redirect to login
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
    
    // Check if user has selected a company
    if (!auth.companyId) {
      // No company selected - redirect to select-company page
      const url = request.nextUrl.clone()
      url.pathname = '/app/select-company'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
    
    // User is authenticated and has company - allow access
    // Add company_id to request headers for API routes to use
    const response = NextResponse.next()
    response.headers.set('x-company-id', auth.companyId)
    response.headers.set('x-user-id', auth.userId as string)
    return response
  }
  
  // ===== AUTH ROUTES (public) =====
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }
  
  // ===== LOCALE HANDLING FOR PUBLIC PAGES =====
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) {
    return NextResponse.next()
  }

  // Redirect to default locale for public pages
  const url = request.nextUrl.clone()
  url.pathname = `/${defaultLocale}${pathname}`
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next|api|admin-api|images|.*\\..*).*)'],
}

