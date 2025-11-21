import type { Lead } from './lead-types'

interface FetchLeadsParams {
  q?: string
  limit?: number
  offset?: number
}

export async function fetchLeads(
  params: FetchLeadsParams,
  adminToken: string
): Promise<Lead[]> {
  const urlParams = new URLSearchParams()
  if (params.q) urlParams.append('q', params.q)
  if (params.limit) urlParams.append('limit', params.limit.toString())
  if (params.offset) urlParams.append('offset', params.offset.toString())

  const url = `/admin-api/leads?${urlParams.toString()}`
  const r = await fetch(url, { headers: { 'x-admin-token': adminToken } })
  const text = await r.text()
  
  if (!r.ok) {
    throw new Error(`${r.status}: ${text}`)
  }
  
  return JSON.parse(text)
}

export async function updateLead(
  id: string,
  updates: Partial<Lead>,
  adminToken: string
): Promise<Lead> {
  const r = await fetch('/admin-api/leads', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': adminToken
    },
    body: JSON.stringify({ id, ...updates })
  })

  const responseText = await r.text()
  if (!r.ok) {
    let errorMessage = `Update failed: ${r.status}`
    try {
      const errorData = JSON.parse(responseText)
      errorMessage = errorData.error || errorData.message || errorMessage
    } catch {
      errorMessage = responseText || errorMessage
    }
    throw new Error(errorMessage)
  }

  try {
    return JSON.parse(responseText)
  } catch {
    throw new Error('Could not parse response as JSON')
  }
}

export async function deleteLead(
  id: string,
  adminToken: string
): Promise<void> {
  const r = await fetch(`/admin-api/leads?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-admin-token': adminToken }
  })
  const body = await r.text()
  
  if (!r.ok) {
    throw new Error(`${r.status}: ${body}`)
  }
}

