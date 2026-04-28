/**
 * Profiles API Client — single abstraction over the NestJS upstream.
 * All route handlers use this instead of constructing fetch calls directly (DIP).
 */

import { NextResponse } from 'next/server'

const BASE_URL = process.env.PROFILES_API_URL || 'http://localhost:3002'
const TIMEOUT_MS = 30_000

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
  const url = `${BASE_URL}${path}?company_id=${options.companyId}`

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
