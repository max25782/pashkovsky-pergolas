import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Inlined to avoid Node.js imports in Edge Runtime
const locales = ['he', 'ru', 'en'] as const
const defaultLocale = 'he'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
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

  const newPath = pathname === '/' ? `/${defaultLocale}` : `/${defaultLocale}${pathname}`
  return NextResponse.redirect(new URL(newPath, request.url))
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
