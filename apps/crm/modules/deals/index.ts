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
export { useDealLaborMap } from '@/components/admin/hooks/useDealLaborMap'
export {
  useDealMaterialOrdersTotalsMap,
  type DealMaterialOrdersSummary,
} from '@/components/admin/hooks/useDealMaterialOrdersTotalsMap'

// UI Components
export { DealCard } from '@/components/admin/DealCard'
export { DealModal } from '@/components/admin/DealModal'
export { CreateDealModal } from '@/components/admin/CreateDealModal'
export { DealsTable } from '@/components/admin/DealsTable'
export { DealsTableView } from '@/components/admin/DealsTableView'
export { DealsFilters } from '@/components/admin/DealsFilters'
export { DealsHeader } from '@/components/admin/DealsHeader'
export { DealsStatistics } from '@/components/admin/DealsStatistics'
export { DealsStatus } from '@/components/admin/DealsStatus'
export { KanbanBoard } from '@/components/admin/KanbanBoard'
export { KanbanColumn } from '@/components/admin/KanbanColumn'
export { DealPaymentsWidget } from '@/components/admin/DealPaymentsWidget'
export { MaterialOrdersList } from '@/components/admin/MaterialOrdersList'
export { SketchModal } from '@/components/admin/SketchModal'
export { LaundryClosetModal } from '@/components/admin/LaundryClosetModal'
export { RailingsFormFields } from '@/components/admin/RailingsFormFields'

// Deal form templates
export { PergolaDealForm } from '@/components/admin/deals/templates/PergolaDealForm'
export { RailingsDealForm } from '@/components/admin/deals/templates/RailingsDealForm'
export { DealTemplateRenderer } from '@/components/admin/deals/templates/DealTemplateRenderer'
export { ContractorPaymentPlan } from '@/components/admin/deals/templates/ContractorPaymentPlan'
