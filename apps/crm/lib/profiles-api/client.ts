/**
 * Profiles API Client — single abstraction over the NestJS upstream.
 * All route handlers use this instead of constructing fetch calls directly (DIP).
 */

import { NextResponse } from 'next/server'
import { isProduction, MissingEnvError } from '@/lib/env/require-env'

const TIMEOUT_MS = 30_000

export class InsecureProfilesApiUrlError extends Error {
  constructor(url: string) {
    super(`PROFILES_API_URL must use https:// in production, got: ${url}`)
    this.name = 'InsecureProfilesApiUrlError'
  }
}

/**
 * Resolve the upstream base URL, without a trailing slash.
 *
 * Single source of truth for `PROFILES_API_URL`: the route handlers used to read
 * the variable independently, each with its own `|| 'http://localhost:3002'`
 * fallback, so an unset variable in production made them call localhost and
 * report a connection error instead of a misconfiguration.
 *
 * Requests carry the caller's JWT in an Authorization header, so plaintext HTTP
 * to the load balancer would expose it in transit — hence the https requirement
 * in production. Resolved per call rather than at module load so a bad value
 * fails the affected request instead of the whole deployment.
 */
export function getProfilesApiBaseUrl(): string {
  const configured = process.env.PROFILES_API_URL?.trim()

  if (!configured) {
    if (isProduction) throw new MissingEnvError(['PROFILES_API_URL'])
    return 'http://localhost:3002'
  }

  const normalized = configured.endsWith('/') ? configured.slice(0, -1) : configured

  if (isProduction && !normalized.startsWith('https://')) {
    throw new InsecureProfilesApiUrlError(normalized)
  }

  return normalized
}

interface ProxyOptions {
  method?: string
  authHeader?: string | null
  body?: unknown
  companyId: string
}

interface ProxyResult {
  ok: boolean
  status: number
  data: unknown
}

async function proxyRequest(path: string, options: ProxyOptions): Promise<ProxyResult> {
  const url = `${getProfilesApiBaseUrl()}${path}?company_id=${options.companyId}`

  const headers: Record<string, string> = {
    'X-Company-Id': options.companyId,
  }
  if (options.authHeader) headers['Authorization'] = options.authHeader
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  const data = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, data }
}

export function handleProxyError(error: unknown, label: string): NextResponse {
  console.error(`[Profiles API ${label}] Error:`, error)

  if (error instanceof MissingEnvError || error instanceof InsecureProfilesApiUrlError) {
    return NextResponse.json({ error: 'Profiles API not configured' }, { status: 500 })
  }

  const e = error as Error & { name?: string }
  const isTimeout = e?.name === 'TimeoutError' || e?.name === 'AbortError'
  return NextResponse.json(
    { error: isTimeout ? 'Request to Profiles API timed out' : (e?.message ?? String(error)) || 'Internal server error' },
    { status: isTimeout ? 504 : 500 },
  )
}

export const profilesApi = {
  orders: {
    list: (companyId: string, authHeader?: string | null) =>
      proxyRequest('/orders', { companyId, authHeader }),

    get: (id: string, companyId: string, authHeader?: string | null) =>
      proxyRequest(`/orders/${id}`, { companyId, authHeader }),

    patch: (id: string, companyId: string, body: unknown, authHeader?: string | null) =>
      proxyRequest(`/orders/${id}`, { method: 'PATCH', companyId, body, authHeader }),

    delete: (id: string, companyId: string, authHeader?: string | null) =>
      proxyRequest(`/orders/${id}`, { method: 'DELETE', companyId, authHeader }),

    generatePdf: (id: string, companyId: string, authHeader?: string | null) =>
      proxyRequest(`/orders/${id}/pdf`, { method: 'POST', companyId, authHeader }),

    patchItem: (
      orderId: string,
      itemId: string,
      companyId: string,
      body: unknown,
      authHeader?: string | null,
    ) =>
      proxyRequest(`/orders/${orderId}/items/${itemId}`, {
        method: 'PATCH',
        companyId,
        body,
        authHeader,
      }),
  },
}
