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
  
  // Handle CRM subdomain - always work on subdomain, regardless of environment
  if (isCRMSubdomain) {
    // If accessing root, redirect to default-locale admin dashboard
    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = `/${defaultLocale}/admin`
      return NextResponse.redirect(url)
    }
    
    // Allow locale-prefixed admin routes (e.g. /he/admin/leads)
    const hasLocaleAdmin = locales.some(
      (locale) => pathname.startsWith(`/${locale}/admin`)
    )
    if (hasLocaleAdmin) {
      return NextResponse.next()
    }

    // If accessing admin routes without locale, rewrite to include default locale
    if (pathname.startsWith('/admin')) {
      const url = request.nextUrl.clone()
      url.pathname = `/${defaultLocale}${pathname}`
      return NextResponse.rewrite(url)
    }
    
    // Redirect ALL non-admin routes to admin dashboard (including locale-only paths like /he, /ru, /en)
    if (!pathname.startsWith('/admin') && !pathname.startsWith('/api') && !pathname.startsWith('/_next')) {
      const url = request.nextUrl.clone()
      url.pathname = `/${defaultLocale}/admin`
      return NextResponse.redirect(url)
    }
    
    return NextResponse.next()
  }
  
  // Block admin routes on main domain - redirect to CRM subdomain (only if CRM enabled)
  if (isCRMEnabled && pathname.startsWith('/admin')) {
    const url = request.nextUrl.clone()
    // Extract domain without subdomain (e.g., pashkovsky-group.com)
    const domainParts = hostname.split('.')
    const baseDomain = domainParts.length > 2 
      ? domainParts.slice(1).join('.') 
      : hostname
    url.host = `crm.${baseDomain}`
    url.pathname = pathname
    return NextResponse.redirect(url)
  }
  
  // If CRM is disabled and trying to access admin, return 404 or redirect to home
  if (!isCRMEnabled && pathname.startsWith('/admin')) {
    const url = request.nextUrl.clone()
    url.pathname = `/${defaultLocale}`
    return NextResponse.redirect(url)
  }
  
  // Original locale handling for main domain
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) return NextResponse.next()

  // Redirect to default locale
  const url = request.nextUrl.clone()
  url.pathname = `/${defaultLocale}${pathname}`
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next|api|admin-api|images|.*\\..*).*)'],
}

