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






