import type { Deal } from './deal-types'

export function filterDeals(
  deals: Deal[],
  filters: {
    searchQuery?: string
    stageFilter?: string
    projectTypeFilter?: string
  }
): Deal[] {
  return deals.filter(deal => {
    // Stage filter
    if (filters.stageFilter && deal.stage !== filters.stageFilter) {
      return false
    }
    
    // Project type filter
    if (filters.projectTypeFilter && deal.project_type !== filters.projectTypeFilter) {
      return false
    }
    
    // Search query
    if (filters.searchQuery) {
      const searchLower = filters.searchQuery.toLowerCase()
      const matchesSearch = (
        deal.customer_name?.toLowerCase().includes(searchLower) ||
        deal.customer_phone?.includes(filters.searchQuery) ||
        deal.material?.toLowerCase().includes(searchLower) ||
        deal.color_ral?.toLowerCase().includes(searchLower) ||
        deal.notes?.toLowerCase().includes(searchLower) ||
        deal.customer_email?.toLowerCase().includes(searchLower) ||
        deal.customer_city?.toLowerCase().includes(searchLower)
      )
      if (!matchesSearch) return false
    }
    
    return true
  })
}

export function getDealsByStage(deals: Deal[], stage: string): Deal[] {
  return deals.filter(deal => (deal.stage || 'new') === stage)
}

