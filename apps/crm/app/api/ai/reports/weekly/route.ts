/**
 * AI Weekly Reports API
 * Генерирует еженедельный отчет с AI-инсайтами
 * 
 * GET /api/ai/reports/weekly
 * Query: ?week=2025-W01 (optional, defaults to current week)
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

interface WeeklyData {
  week: string
  dateRange: { start: string; end: string }
  deals: {
    total: number
    byStatus: Record<string, number>
    totalValue: number
    avgValue: number
    new: number
    closed: number
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
  }
  financial: {
    revenue: number
    costs: number
    profit: number
    profitMargin: number
  }
}

function getWeekDateRange(weekString: string): { start: Date; end: Date } {
  // Parse week string (e.g., "2025-W01")
  const [year, week] = weekString.split('-W').map(Number)
  
  // Calculate start of week (Monday)
  const jan4 = new Date(year, 0, 4)
  const startOfWeek = new Date(jan4)
  startOfWeek.setDate(jan4.getDate() - jan4.getDay() + 1 + (week - 1) * 7)
  
  // Calculate end of week (Sunday)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)
  
  return { start: startOfWeek, end: endOfWeek }
}

function getCurrentWeekString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const jan4 = new Date(year, 0, 4)
  const weekNumber = Math.ceil(((now.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7)
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`
}

async function collectWeeklyData(companyId: string, dateRange: { start: Date; end: Date }): Promise<WeeklyData> {
  if (!supabase) throw new Error('Supabase not configured')
  
  const startISO = dateRange.start.toISOString()
  const endISO = dateRange.end.toISOString()
  
  // Fetch deals
  const { data: deals } = await supabase
    .from('deals')
    .select('*')
    .eq('company_id', companyId)
    .gte('created_at', startISO)
    .lte('created_at', endISO)
  
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
  }
  
  deals?.forEach((deal) => {
    dealsData.byStatus[deal.status] = (dealsData.byStatus[deal.status] || 0) + 1
    if (deal.estimated_value) dealsData.totalValue += parseFloat(deal.estimated_value)
    if (deal.status === 'new') dealsData.new++
    if (deal.status === 'closed') dealsData.closed++
  })
  
  dealsData.avgValue = dealsData.total > 0 ? dealsData.totalValue / dealsData.total : 0
  
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
    week: getCurrentWeekString(),
    dateRange: {
      start: dateRange.start.toISOString().split('T')[0],
      end: dateRange.end.toISOString().split('T')[0],
    },
    deals: dealsData,
    leads: leadsData,
    workers: {
      ...workersData,
      activeWorkers: workersData.activeWorkers.size,
    } as any,
    financial: financialData,
  }
}

async function generateAIReport(data: WeeklyData): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('Gemini API not configured')
  
  const prompt = `אתה מנתח עסקי מומחה לחברות פרגולות ומעקות אלומיניום. 
צור דוח שבועי מקצועי ומפורט על סמך הנתונים הבאים.

נתוני השבוע (${data.dateRange.start} עד ${data.dateRange.end}):

## עסקאות (Deals)
- סה״כ: ${data.deals.total}
- עסקאות חדשות: ${data.deals.new}
- עסקאות שנסגרו: ${data.deals.closed}
- ערך כולל: ₪${data.deals.totalValue.toLocaleString()}
- ערך ממוצע: ₪${data.deals.avgValue.toLocaleString()}
- פילוח לפי סטטוס: ${JSON.stringify(data.deals.byStatus)}

## לידים (Leads)
- סה״כ: ${data.leads.total}
- שיעור המרה: ${data.leads.conversionRate.toFixed(1)}%
- פילוח לפי סטטוס: ${JSON.stringify(data.leads.byStatus)}
- פילוח לפי מקור: ${JSON.stringify(data.leads.bySource)}

## עובדים (Workers)
- עובדים פעילים: ${data.workers.activeWorkers}
- שעות עבודה: ${data.workers.totalHours}
- עלות כוח אדם: ₪${data.workers.totalCost.toLocaleString()}

## פיננסי (Financial)
- הכנסות: ₪${data.financial.revenue.toLocaleString()}
- הוצאות: ₪${data.financial.costs.toLocaleString()}
- רווח: ₪${data.financial.profit.toLocaleString()}
- שולי רווח: ${data.financial.profitMargin.toFixed(1)}%

אנא צור דוח בעברית הכולל:

1. **סיכום ביצועים** - תמצית של השבוע
2. **נקודות חזקות** - מה הלך טוב?
3. **אתגרים** - מה דורש תשומת לב?
4. **תובנות AI** - ניתוח מעמיק של המגמות
5. **המלצות לשבוע הבא** - פעולות קונקרטיות לשיפור

השתמש באימוג'ים 📊 💰 👷 📈 ⚡ כדי להפוך את הדוח לקריא יותר.
החזר את הדוח בפורמט Markdown.`

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`
  
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
        maxOutputTokens: 2000,
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

    // 2. Rate limit — 3 weekly reports per company per day
    const rl = await checkLimit(aiReportLimiter, `weekly:${auth.companyId}`)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Report generation limit reached. Try again tomorrow.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
      )
    }

    // 3. Parse week parameter
    const weekParam = request.nextUrl.searchParams.get('week')
    const week = weekParam || getCurrentWeekString()
    const dateRange = getWeekDateRange(week)
    
    // 4. Collect data
    const weeklyData = await collectWeeklyData(auth.companyId, dateRange)
    
    // 5. Generate AI report
    const aiReport = await generateAIReport(weeklyData)
    
    return NextResponse.json({
      week,
      dateRange: weeklyData.dateRange,
      data: weeklyData,
      report: aiReport,
      generatedAt: new Date().toISOString(),
    })
  } catch (error: unknown) {
    console.error('[Weekly Report] Error:', error)
    return NextResponse.json({ error: 'Report generation temporarily unavailable' }, { status: 500 })
  }
}

