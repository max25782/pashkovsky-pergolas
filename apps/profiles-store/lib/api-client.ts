const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'

export interface Profile {
  id: string
  code: string
  name_he: string
  name_ru?: string
  name_en?: string
  dimensions: string
  image_url?: string
  weight_per_meter: number
  price_per_kg: number
  available_lengths: number[]
  category?: string
  sku?: string
  stock?: {
    [length: string]: {
      available: number
      color: string
    }
  }
}

export interface StockInfo {
  color: string
  length_meters: number
  qty_available: number
  qty_reserved: number
}

export interface OrderData {
  customer: {
    name: string
    phone: string
    email: string
    city: string
    address: string
  }
  items: Array<{
    profile_id: string
    color: string
    length_meters: number
    quantity_pieces: number
    price_per_piece: number
  }>
}

export async function fetchProfiles(filters?: {
  category?: string
  search?: string
  color?: string
  company_id?: string
}): Promise<Profile[]> {
  const params = new URLSearchParams()
  
  // company_id is required by the API
  const companyId = filters?.company_id || process.env.NEXT_PUBLIC_COMPANY_ID
  if (!companyId) {
    throw new Error('company_id is required but not provided')
  }
  params.append('company_id', companyId)
  
  if (filters?.category) params.append('category', filters.category)
  if (filters?.search) params.append('search', filters.search)
  if (filters?.color) params.append('color', filters.color)

  try {
    const res = await fetch(`${API_URL}/profiles?${params}`, {
      cache: 'no-store',
    })
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error')
      throw new Error(`Failed to fetch profiles: ${res.status} - ${errorText}`)
    }
    return res.json()
  } catch (error) {
    if (error instanceof Error && error.message.includes('fetch')) {
      throw new Error(`Cannot connect to API at ${API_URL}. Make sure the Profiles API is running.`)
    }
    throw error
  }
}

export async function fetchProfile(id: string, companyId?: string): Promise<Profile> {
  const params = new URLSearchParams()
  
  // company_id is required by the API
  const finalCompanyId = companyId || process.env.NEXT_PUBLIC_COMPANY_ID
  if (!finalCompanyId) {
    throw new Error('company_id is required but not provided')
  }
  params.append('company_id', finalCompanyId)

  try {
    const res = await fetch(`${API_URL}/profiles/${id}?${params}`, {
      cache: 'no-store',
    })
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error')
      throw new Error(`Failed to fetch profile: ${res.status} - ${errorText}`)
    }
    return res.json()
  } catch (error) {
    if (error instanceof Error && error.message.includes('fetch')) {
      throw new Error(`Cannot connect to API at ${API_URL}. Make sure the Profiles API is running.`)
    }
    throw error
  }
}

export async function fetchStock(profileId: string, companyId?: string): Promise<StockInfo[]> {
  const params = new URLSearchParams()
  params.append('profile_id', profileId)
  if (companyId) params.append('company_id', companyId)

  try {
    const res = await fetch(`${API_URL}/stock?${params}`, {
      cache: 'no-store',
    })
    if (!res.ok) {
      // Stock endpoint may not be implemented yet - return empty array
      return []
    }
    return res.json()
  } catch (error) {
    console.warn('Failed to fetch stock:', error)
    return []
  }
}

export async function submitOrder(order: OrderData, companyId?: string): Promise<{ id: string }> {
  const params = new URLSearchParams()
  if (companyId) params.append('company_id', companyId)

  try {
    const res = await fetch(`${API_URL}/orders?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Failed to submit order' }))
      throw new Error(error.message || 'Failed to submit order')
    }
    return res.json()
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to submit order')
  }
}
