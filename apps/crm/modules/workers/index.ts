/**
 * modules/workers — Worker & Shift Management
 *
 * Canonical import path for all workers-related code.
 * New code should import from '@/modules/workers'.
 *
 * Responsibilities:
 *   - Employee profiles
 *   - Shift scheduling & timesheets
 *   - Labor cost calculations
 *   - Assignment to projects
 */

// Types
export {
  type Worker,
  type WorkShift,
  type WorkShiftDraft,
  type WorkShiftGroupedByDate,
  type ProjectProfit,
  type MonthlyReportRow,
  type MonthlyReport,
  type WorkerShiftType,
  type WorkerShift,
  type WorkerShiftSummary,
  type WorkerShiftDraft,
} from '@/types/workers'

// Calculations
export {
  computeMinutesWorked,
  computeShiftCost,
  calcLaborCost,
  calcProfit,
  groupShiftsByDate,
  calculateProjectProfit,
  formatCurrencyILS,
  formatPercent,
} from '@/lib/workers/calculations'

// UI Components
export { default as WorkerModal } from '@/components/workers/WorkerModal'
export { default as WorkersTable } from '@/components/workers/WorkersTable'
export { default as TimesheetPanel } from '@/components/workers/TimesheetPanel'
export { default as AddWorkShiftModal } from '@/components/workers/AddWorkShiftModal'
export { default as BulkPlanForm } from '@/components/workers/BulkPlanForm'
export { default as ShiftForm } from '@/components/workers/ShiftForm'
export { default as WorkLogSection } from '@/components/workers/WorkLogSection'
export { default as ProfitWidget } from '@/components/workers/ProfitWidget'
