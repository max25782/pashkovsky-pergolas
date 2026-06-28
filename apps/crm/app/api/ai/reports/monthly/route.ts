/**
 * AI Monthly Reports API
 * Генерирует ежемесячный отчет с AI-инсайтами и сравнением с предыдущим месяцем
 * 
 * GET /api/ai/reports/monthly
 * Query: ?month=2025-01 (optional, defaults to current month)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aiReportLimiter, checkLimit } from '@/lib/middleware/rate-limit'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null

interface MonthlyData {
  month: string
  dateRange: { start: string; end: string }
  deals: {
    total: number
    byStatus: Record<string, number>
    totalValue: number
    avgValue: number
    new: number
    closed: number
    conversion: number
  }
  leads: {
    total: number
    byStatus: Record<string, number>
    bySource: Record<string, number>
    conversionRate: number
  }
  workers: {
    totalHours: number
    totalCost: number
    activeWorkers: number
    avgHoursPerWorker: number
  }
  financial: {
    revenue: number
    costs: number
    profit: number
    profitMargin: number
  }
  comparison?: {
    deals: { change: number; trend: 'up' | 'down' | 'stable' }
    revenue: { change: number; trend: 'up' | 'down' | 'stable' }
    profit: { change: number; trend: 'up' | 'down' | 'stable' }
    leads: { change: number; trend: 'up' | 'down' | 'stable' }
  }
}

function getMonthDateRange(monthString: string): { start: Date; end: Date } {
  const [year, month] = monthString.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59, 999)
  return { start, end }
}

function getPreviousMonth(monthString: string): string {
  const [year, month] = monthString.split('-').map(Number)
  if (month === 1) {
    return `${year - 1}-12`
  }
  return `${year}-${(month - 1).toString().padStart(2, '0')}`
}

function getCurrentMonthString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  return `${year}-${month}`
}

async function collectMonthlyData(companyId: string, dateRange: { start: Date; end: Date }): Promise<Omit<MonthlyData, 'month' | 'dateRange' | 'comparison'>> {
  if (!supabase) throw new Error('Supabase not configured')
  
  const startISO = dateRange.start.toISOString()
  const endISO = dateRange.end.toISOString()
  
  // Fetch deals by installation_date (revenue attribution by installation month)
  const { data: deals } = await supabase
    .from('deals')
    .select('*')
    .eq('company_id', companyId)
    .eq('stage', 'done')
    .not('installation_date', 'is', null)
    .gte('installation_date', startISO)
    .lte('installation_date', endISO)
  
  // Fetch leads
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('company_id', companyId)
    .gte('created_at', startISO)
    .lte('created_at', endISO)
  
  // Fetch work shifts
  const { data: workShifts } = await supabase
    .from('work_shifts')
    .select(`
      *,
      workers (
        daily_rate
      )
    `)
    .eq('company_id', companyId)
    .gte('date', dateRange.start.toISOString().split('T')[0])
    .lte('date', dateRange.end.toISOString().split('T')[0])
  
  // Aggregate deals data
  const dealsData = {
    total: deals?.length || 0,
    byStatus: {} as Record<string, number>,
    totalValue: 0,
    avgValue: 0,
    new: 0,
    closed: 0,
    conversion: 0,
  }
  
  deals?.forEach((deal: { stage?: string; price?: string | number }) => {
    const stage = deal.stage ?? 'unknown'
    dealsData.byStatus[stage] = (dealsData.byStatus[stage] || 0) + 1
    if (deal.price) dealsData.totalValue += parseFloat(String(deal.price))
    if (stage === 'new') dealsData.new++
    if (stage === 'done') dealsData.closed++
  })
  
  dealsData.avgValue = dealsData.total > 0 ? dealsData.totalValue / dealsData.total : 0
  dealsData.conversion = dealsData.new > 0 ? (dealsData.closed / dealsData.new) * 100 : 0
  
  // Aggregate leads data
  const leadsData = {
    total: leads?.length || 0,
    byStatus: {} as Record<string, number>,
    bySource: {} as Record<string, number>,
    conversionRate: 0,
  }
  
  leads?.forEach((lead) => {
    leadsData.byStatus[lead.status] = (leadsData.byStatus[lead.status] || 0) + 1
    if (lead.source) {
      leadsData.bySource[lead.source] = (leadsData.bySource[lead.source] || 0) + 1
    }
  })
  
  const convertedLeads = leads?.filter(l => l.status === 'converted').length || 0
  leadsData.conversionRate = leadsData.total > 0 ? (convertedLeads / leadsData.total) * 100 : 0
  
  // Aggregate workers data
  const workersData = {
    totalHours: 0,
    totalCost: 0,
    activeWorkers: new Set<string>(),
  }
  
  workShifts?.forEach((shift: any) => {
    if (shift.hours_worked) {
      workersData.totalHours += shift.hours_worked
      workersData.activeWorkers.add(shift.worker_id)
      if (shift.workers?.daily_rate) {
        workersData.totalCost += (shift.hours_worked / 8) * shift.workers.daily_rate
      }
    }
  })
  
  const avgHoursPerWorker = workersData.activeWorkers.size > 0 
    ? workersData.totalHours / workersData.activeWorkers.size 
    : 0
  
  // Financial data
  const financialData = {
    revenue: dealsData.totalValue,
    costs: workersData.totalCost,
    profit: dealsData.totalValue - workersData.totalCost,
    profitMargin: dealsData.totalValue > 0 
      ? ((dealsData.totalValue - workersData.totalCost) / dealsData.totalValue) * 100 
      : 0,
  }
  
  return {
    deals: dealsData,
    leads: leadsData,
    workers: {
      ...workersData,
      activeWorkers: workersData.activeWorkers.size,
      avgHoursPerWorker,
    } as any,
    financial: financialData,
  }
}

async function generateAIReport(currentData: MonthlyData, previousData?: Omit<MonthlyData, 'month' | 'dateRange' | 'comparison'>): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('Gemini API not configured')
  
  let comparisonText = ''
  if (previousData) {
    comparisonText = `\n## השוואה לחודש הקודם:
- עסקאות: ${currentData.deals.total} (${currentData.comparison?.deals.change}%)
- הכנסות: ₪${currentData.financial.revenue.toLocaleString()} (${currentData.comparison?.revenue.change}%)
- רווח: ₪${currentData.financial.profit.toLocaleString()} (${currentData.comparison?.profit.change}%)
- לידים: ${currentData.leads.total} (${currentData.comparison?.leads.change}%)`
  }
  
  const prompt = `אתה מנתח עסקי בכיר מומחה לחברות פרגולות ומעקות אלומיניום.
צור דוח חודשי מקצועי, מפורט ואסטרטגי על סמך הנתונים הבאים.

נתוני החודש (${currentData.dateRange.start} עד ${currentData.dateRange.end}):

## עסקאות (Deals)
- סה״כ עסקאות: ${currentData.deals.total}
- עסקאות חדשות: ${currentData.deals.new}
- עסקאות שנסגרו: ${currentData.deals.closed}
- שיעור המרה: ${currentData.deals.conversion.toFixed(1)}%
- ערך כולל: ₪${currentData.deals.totalValue.toLocaleString()}
- ערך ממוצע לעסקה: ₪${currentData.deals.avgValue.toLocaleString()}
- פילוח לפי סטטוס: ${JSON.stringify(currentData.deals.byStatus)}

## לידים (Leads)
- סה״כ לידים: ${currentData.leads.total}
- שיעור המרה ללידים: ${currentData.leads.conversionRate.toFixed(1)}%
- פילוח לפי סטטוס: ${JSON.stringify(currentData.leads.byStatus)}
- פילוח לפי מקור: ${JSON.stringify(currentData.leads.bySource)}

## עובדים (Workers)
- עובדים פעילים: ${currentData.workers.activeWorkers}
- סה״כ שעות עבודה: ${currentData.workers.totalHours}
- ממוצע שעות לעובד: ${currentData.workers.avgHoursPerWorker.toFixed(1)}
- עלות כוח אדם: ₪${currentData.workers.totalCost.toLocaleString()}

## פיננסי (Financial)
- הכנסות: ₪${currentData.financial.revenue.toLocaleString()}
- הוצאות: ₪${currentData.financial.costs.toLocaleString()}
- רווח: ₪${currentData.financial.profit.toLocaleString()}
- שולי רווח: ${currentData.financial.profitMargin.toFixed(1)}%
${comparisonText}

אנא צור דוח מקיף בעברית הכולל:

1. **📊 סיכום ביצועים** - סקירה כללית של החודש
2. **💪 הישגים מרכזיים** - מה עבד טוב במיוחד?
3. **⚠️ אתגרים וחולשות** - מה דורש תשומת לב דחופה?
4. **📈 ניתוח מגמות** - זיהוי דפוסים והתפתחויות
5. **💡 תובנות AI מתקדמות** - ניתוח עמוק של הנתונים
6. **🎯 המלצות אסטרטגיות** - פעולות קונקרטיות לחודש הבא
7. **🔮 תחזית** - צפי לחודש הבא על סמך המגמות

${previousData ? '8. **📉 ניתוח השוואתי** - מה השתנה מהחודש הקודם ומדוע?' : ''}

השתמש בפורמט Markdown עם כותרות, רשימות ואימוג'ים.
הדגש מספרים חשובים באמצעות **bold**.
הפוך את הדוח למקצועי, אבל גם קריא ומעניין.`

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 3000,
      },
    }),
  })
  
  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`)
  }
  
  const responseData = await response.json()
  return responseData.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// Authentication helper
async function authenticateRequest(request: NextRequest): Promise<{ userId: string; companyId: string } | null> {
  const authHeader = request.headers.get('authorization')
  const adminToken = request.headers.get('x-admin-token')
  
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    if (!supabase) return null
    
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    
    const { data: member } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .single()
    
    if (!member) return null
    
    return { userId: user.id, companyId: member.company_id }
  }
  
  if (adminToken) {
    const defaultCompanyId = process.env.DEFAULT_COMPANY_ID
    if (!defaultCompanyId) return null
    
    return { userId: 'admin', companyId: defaultCompanyId }
  }
  
  return null
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const auth = await authenticateRequest(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Rate limit — 3 monthly reports per company per day
    const rl = await checkLimit(aiReportLimiter, `monthly:${auth.companyId}`)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Report generation limit reached. Try again tomorrow.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
      )
    }

    // 3. Parse month parameter
    const monthParam = request.nextUrl.searchParams.get('month')
    const month = monthParam || getCurrentMonthString()
    const dateRange = getMonthDateRange(month)
    
    // 3. Collect current month data
    const currentMonthData = await collectMonthlyData(auth.companyId, dateRange)
    
    // 4. Collect previous month data for comparison
    const previousMonth = getPreviousMonth(month)
    const previousDateRange = getMonthDateRange(previousMonth)
    let previousMonthData: Omit<MonthlyData, 'month' | 'dateRange' | 'comparison'> | undefined
    let comparison: MonthlyData['comparison'] | undefined
    
    try {
      previousMonthData = await collectMonthlyData(auth.companyId, previousDateRange)
      
      // Calculate comparisons
      const calcChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0
        return ((current - previous) / previous) * 100
      }
      
      const getTrend = (change: number): 'up' | 'down' | 'stable' => {
        if (Math.abs(change) < 5) return 'stable'
        return change > 0 ? 'up' : 'down'
      }
      
      const dealsChange = calcChange(currentMonthData.deals.total, previousMonthData.deals.total)
      const revenueChange = calcChange(currentMonthData.financial.revenue, previousMonthData.financial.revenue)
      const profitChange = calcChange(currentMonthData.financial.profit, previousMonthData.financial.profit)
      const leadsChange = calcChange(currentMonthData.leads.total, previousMonthData.leads.total)
      
      comparison = {
        deals: { change: parseFloat(dealsChange.toFixed(1)), trend: getTrend(dealsChange) },
        revenue: { change: parseFloat(revenueChange.toFixed(1)), trend: getTrend(revenueChange) },
        profit: { change: parseFloat(profitChange.toFixed(1)), trend: getTrend(profitChange) },
        leads: { change: parseFloat(leadsChange.toFixed(1)), trend: getTrend(leadsChange) },
      }
    } catch (error) {
      console.warn('[Monthly Report] Could not fetch previous month data:', error)
    }
    
    const monthlyData: MonthlyData = {
      month,
      dateRange: {
        start: dateRange.start.toISOString().split('T')[0],
        end: dateRange.end.toISOString().split('T')[0],
      },
      ...currentMonthData,
      comparison,
    }
    
    // 5. Generate AI report
    const aiReport = await generateAIReport(monthlyData, previousMonthData)
    
    return NextResponse.json({
      month,
      dateRange: monthlyData.dateRange,
      data: monthlyData,
      report: aiReport,
      generatedAt: new Date().toISOString(),
    })
  } catch (error: unknown) {
    console.error('[Monthly Report] Error:', error)
    return NextResponse.json(
      { error: 'Report generation temporarily unavailable' },
      { status: 500 }
    )
  }
}

