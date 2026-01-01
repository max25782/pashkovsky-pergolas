// Material Order Types

export interface MaterialOrder {
  id: string
  deal_id: string
  offer_id?: string | null
  
  // Material details
  material_type: string
  material_description?: string | null
  quantity?: number | null
  unit?: string | null
  
  // Supplier information
  supplier_name?: string | null
  supplier_contact?: string | null
  supplier_email?: string | null
  supplier_phone?: string | null
  
  // Order details
  order_date: string
  expected_delivery_date?: string | null
  actual_delivery_date?: string | null
  
  // Financial
  unit_price?: number | null
  total_price?: number | null
  currency?: string | null
  
  // Status
  status: 'ordered' | 'confirmed' | 'in_transit' | 'delivered' | 'cancelled'
  
  // Tracking
  tracking_number?: string | null
  tracking_url?: string | null
  
  // Notes
  notes?: string | null
  internal_notes?: string | null
  
  // Metadata
  created_at: string
  updated_at: string
  created_by?: string | null
}

export interface MaterialOrderCreate {
  deal_id: string
  offer_id?: string | null
  material_type: string
  material_description?: string | null
  quantity?: number | null
  unit?: string | null
  supplier_name?: string | null
  supplier_contact?: string | null
  supplier_email?: string | null
  supplier_phone?: string | null
  order_date?: string | null
  expected_delivery_date?: string | null
  unit_price?: number | null
  total_price?: number | null
  currency?: string | null
  status?: 'ordered' | 'confirmed' | 'in_transit' | 'delivered' | 'cancelled'
  tracking_number?: string | null
  tracking_url?: string | null
  notes?: string | null
  internal_notes?: string | null
}




