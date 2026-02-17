import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { locales, defaultLocale, type Locale } from './lib/locales'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // Skip middleware for static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    (pathname.includes('.') && pathname !== '/favicon.ico') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) {
    return NextResponse.next()
  }

  // Redirect root and other paths to default locale
  const locale = defaultLocale
  const newPath = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`
  const newUrl = new URL(newPath, request.url)
  return NextResponse.redirect(newUrl)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next (Next.js internal)
     * - favicon.ico (favicon file)
     * - files with extensions (images, etc.)
     */
    '/',
    '/((?!api|_next|favicon\\.ico|.*\\..*).+)',
  ],
}
