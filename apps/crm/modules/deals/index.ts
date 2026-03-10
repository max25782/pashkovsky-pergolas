/**
 * modules/deals — Deal Pipeline Management
 *
 * Canonical import path for all deals-related code.
 * New code should import from '@/modules/deals'.
 *
 * Responsibilities:
 *   - Deal pipeline & stages
 *   - Deal amounts, discounts, payments
 *   - Kanban board
 *   - Conversion from lead
 */

// Types
export {
  type WorkType,
  type CustomerType,
  type PricingModel,
  type ContractorPaymentProfile,
  type DealRailingsDetails,
  type Deal,
  STAGES_BASE,
  STAGES,
  getStages,
} from '@/components/admin/deal-types'

// API client
export {
  fetchDeals,
  updateDeal,
  createDeal,
  deleteDeal,
} from '@/components/admin/deal-api'

// Filtering
export {
  filterDeals,
  getDealsByStage,
} from '@/components/admin/deal-filters'

// Utilities
export {
  formatDate,
  formatCurrency,
  formatDimensions,
} from '@/components/admin/deal-utils'

// Pergola area calculations
export {
  validatePergolaShape,
  calculatePergolaArea,
  getShapeDescription,
  type ShapeValidationResult,
} from '@/lib/calculations/pergola-area'

// Suntuf sheet calculations
export {
  calculateSuntufSheets,
  calculateSuntufPrice,
  calculateSuntufPriceByArea,
  TOTAL_SHEET_WIDTH,
  EFFECTIVE_WIDTH_SINGLE,
  EFFECTIVE_WIDTH_DOUBLE,
  type SuntufCalculationResult,
  type OverlapType,
} from '@/lib/calculations/suntuf-sheets'

// React hooks
export { useDeals } from '@/components/admin/hooks/useDeals'
export { useDealActions } from '@/components/admin/hooks/useDealActions'
export { useDealDragDrop } from '@/components/admin/hooks/useDealDragDrop'
export { useDealPaymentsMap } from '@/components/admin/hooks/useDealPaymentsMap'

// UI Components
export { default as DealCard } from '@/components/admin/DealCard'
export { default as DealModal } from '@/components/admin/DealModal'
export { default as CreateDealModal } from '@/components/admin/CreateDealModal'
export { default as DealsTable } from '@/components/admin/DealsTable'
export { default as DealsTableView } from '@/components/admin/DealsTableView'
export { default as DealsFilters } from '@/components/admin/DealsFilters'
export { default as DealsHeader } from '@/components/admin/DealsHeader'
export { default as DealsStatistics } from '@/components/admin/DealsStatistics'
export { default as DealsStatus } from '@/components/admin/DealsStatus'
export { default as KanbanBoard } from '@/components/admin/KanbanBoard'
export { default as KanbanColumn } from '@/components/admin/KanbanColumn'
export { default as DealPaymentsWidget } from '@/components/admin/DealPaymentsWidget'
export { default as MaterialOrdersList } from '@/components/admin/MaterialOrdersList'
export { default as SketchModal } from '@/components/admin/SketchModal'
export { default as LaundryClosetModal } from '@/components/admin/LaundryClosetModal'
export { default as RailingsFormFields } from '@/components/admin/RailingsFormFields'

// Deal form templates
export { default as PergolaDealForm } from '@/components/admin/deals/templates/PergolaDealForm'
export { default as RailingsDealForm } from '@/components/admin/deals/templates/RailingsDealForm'
export { default as DealTemplateRenderer } from '@/components/admin/deals/templates/DealTemplateRenderer'
export { default as ContractorPaymentPlan } from '@/components/admin/deals/templates/ContractorPaymentPlan'
