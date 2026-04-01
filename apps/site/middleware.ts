import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const locales = ['he', 'ru', 'en']
const defaultLocale = 'he'

const GCLID_COOKIE = 'gclid'
const GCLID_MAX_AGE = 30 * 24 * 60 * 60 // 30 days in seconds

/** Origins allowed to load profiles + configurator prefill from the CRM embed (comma-separated). */
function configuratorCorsAllowlist(): string[] {
  const raw = process.env.CONFIGURATOR_CORS_ORIGINS ?? 'http://localhost:3001'
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

function applyConfiguratorCors(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get('origin')
  const allowed = configuratorCorsAllowlist()
  if (origin !== null && origin !== '' && allowed.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.set('Vary', 'Origin')
  }
  return response
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isConfiguratorCorsPath =
    pathname === '/data/profiles.json' || pathname.startsWith('/api/configurator/')
  if (isConfiguratorCorsPath) {
    if (request.method === 'OPTIONS') {
      const res = new NextResponse(null, { status: 204 })
      return applyConfiguratorCors(request, res)
    }
    const res = NextResponse.next()
    return applyConfiguratorCors(request, res)
  }

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
    const isCatalogPdf =
      /^\/(he|ru|en)\/catalog$/.test(pathname) &&
      request.nextUrl.searchParams.get('pdf') === '1'
    if (isCatalogPdf) {
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-catalog-pdf-mode', '1')
      const pdfResponse = NextResponse.next({ request: { headers: requestHeaders } })
      if (gclid && gclid.trim().length > 0) {
        pdfResponse.cookies.set(GCLID_COOKIE, gclid.trim(), {
          maxAge: GCLID_MAX_AGE,
          sameSite: 'lax',
          path: '/',
        })
      }
      return pdfResponse
    }
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
    '/data/profiles.json',
    '/api/configurator/:path*',
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

