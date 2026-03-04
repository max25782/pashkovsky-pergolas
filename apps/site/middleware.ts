import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const locales = ['he', 'ru', 'en']
const defaultLocale = 'he'

const GCLID_COOKIE = 'gclid'
const GCLID_MAX_AGE = 30 * 24 * 60 * 60 // 30 days in seconds

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for static files, API routes, and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // Files with extensions
  ) {
    return NextResponse.next()
  }

  // Capture gclid from URL and store in cookie (30 days)
  const gclid = request.nextUrl.searchParams.get('gclid')
  const response = NextResponse.next()

  if (gclid && gclid.trim().length > 0) {
    response.cookies.set(GCLID_COOKIE, gclid.trim(), {
      maxAge: GCLID_MAX_AGE,
      sameSite: 'lax',
      path: '/',
    })
  }

  // Check if pathname already has a locale
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) {
    return response
  }

  // Redirect to default locale for root path
  if (pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = `/${defaultLocale}`
    const redirectRes = NextResponse.redirect(url)
    if (gclid && gclid.trim().length > 0) {
      redirectRes.cookies.set(GCLID_COOKIE, gclid.trim(), {
        maxAge: GCLID_MAX_AGE,
        sameSite: 'lax',
        path: '/',
      })
    }
    return redirectRes
  }

  // Redirect any other path to include default locale
  const url = request.nextUrl.clone()
  url.pathname = `/${defaultLocale}${pathname}`
  const redirectRes = NextResponse.redirect(url)
  if (gclid && gclid.trim().length > 0) {
    redirectRes.cookies.set(GCLID_COOKIE, gclid.trim(), {
      maxAge: GCLID_MAX_AGE,
      sameSite: 'lax',
      path: '/',
    })
  }
  return redirectRes
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)',
  ],
}

