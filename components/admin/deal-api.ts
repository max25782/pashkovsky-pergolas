import type { Deal } from './deal-types'

interface FetchDealsParams {
  q?: string
  stage?: string
  project_type?: string
  limit?: number
  offset?: number
}

export async function fetchDeals(
  params: FetchDealsParams,
  adminToken: string
): Promise<{ data: Deal[]; count?: number }> {
  const urlParams = new URLSearchParams()
  if (params.q) urlParams.append('q', params.q)
  if (params.stage) urlParams.append('stage', params.stage)
  if (params.project_type) urlParams.append('project_type', params.project_type)
  if (params.limit) urlParams.append('limit', params.limit.toString())
  if (params.offset) urlParams.append('offset', params.offset.toString())

  const url = `/admin-api/deals?${urlParams.toString()}`
  const r = await fetch(url, { headers: { 'x-admin-token': adminToken } })
  const text = await r.text()
  
  if (!r.ok) {
    throw new Error(`${r.status}: ${text}`)
  }
  
  const data = JSON.parse(text)
  return { data: data.data || data || [], count: data.count }
}

export async function updateDeal(
  id: string,
  updates: Partial<Deal>,
  adminToken: string
): Promise<Deal> {
  const r = await fetch('/admin-api/deals', {
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

export async function createDeal(
  dealData: Partial<Deal>,
  adminToken: string
): Promise<Deal> {
  const r = await fetch('/admin-api/deals', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': adminToken
    },
    body: JSON.stringify(dealData)
  })

  const responseText = await r.text()
  if (!r.ok) {
    let errorMessage = `Create failed: ${r.status}`
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

export async function deleteDeal(
  id: string,
  adminToken: string
): Promise<void> {
  const r = await fetch(`/admin-api/deals?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-admin-token': adminToken }
  })
  const body = await r.text()
  
  if (!r.ok) {
    throw new Error(`${r.status}: ${body}`)
  }
}

