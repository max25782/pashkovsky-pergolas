/**
 * TypeScript types for Workers and Work Shifts module
 */

export interface Worker {
  id: string
  firstName: string
  lastName: string
  phone?: string | null
  role?: string | null
  dailyRate: number
  hourlyRate?: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface WorkShift {
  id: string
  projectId: string // dealId
  workerId: string
  date: string // YYYY-MM-DD
  payType: 'daily'
  dailyRateSnapshot: number
  notes?: string | null
  createdAt: string
  updatedAt: string
  // Joined data
  worker?: Worker
}

export interface WorkShiftDraft {
  projectId: string
  workerId: string
  date: string // YYYY-MM-DD
  payType?: 'daily'
  dailyRateSnapshot: number
  notes?: string | null
}

export interface WorkShiftGroupedByDate {
  date: string
  shifts: WorkShift[]
  totalDailyRate: number
}

export interface ProjectProfit {
  revenue: number
  laborCost: number
  profit: number
  laborCostPercent: number
}

export interface MonthlyReportRow {
  projectId: string
  projectName: string
  customerName: string
  revenue: number
  laborCost: number
  profit: number
}

export interface MonthlyReport {
  month: string // YYYY-MM
  totalRevenue: number
  totalLaborCost: number
  totalProfit: number
  projects: MonthlyReportRow[]
}

export type WorkerShiftType = 'work' | 'holiday' | 'day_off'

// Worker shifts (timesheets with start/end time)
export interface WorkerShift {
  id: string
  workerId: string
  dealId: string | null
  projectName?: string | null // Custom text when no deal linked
  shiftDate: string // YYYY-MM-DD
  shiftType: WorkerShiftType
  startTime: string | null // HH:mm
  endTime: string | null // HH:mm
  minutesWorked: number | null
  computedCost: number | null
  note: string | null
  createdAt: string
  updatedAt: string
  deal?: { id: string; customerName?: string; customerCity?: string; projectAddress?: string }
}

export interface WorkerShiftSummary {
  daysWorked: number
  holidayDays: number
  dayOffDays: number
  totalMinutes: number
  totalHours: number
  totalCost: number      // work shifts cost only
  holidayPay: number     // holiday days cost (daily rate × holiday days)
  totalPayable: number   // totalCost + holidayPay (day_off excluded)
  lateDaysCount: number
  avgFinishTime?: string
}

export interface WorkerShiftDraft {
  date: string // YYYY-MM-DD
  shiftType?: WorkerShiftType
  dealId?: string | null
  projectName?: string | null // Custom text when no deal in list
  startTime?: string | null
  endTime?: string | null
  note?: string | null
}






