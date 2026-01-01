/**
 * Weekly Digest Generator
 * 
 * Generates AI-powered weekly analytics digest for companies
 */

import { buildAnalyticsContext } from '@/lib/ai/buildAnalyticsContext'
import { selectSystemPrompt } from '@/lib/ai/prompts'
import { callLLM } from '@/lib/ai/client'
import type { AnalyticsContext, AnalyticsPeriod } from '@/lib/ai/analyticsTypes'
import { DEFAULT_TIMEZONE } from '@/lib/ai/analyticsTypes'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : null

export interface WeeklyDigestResult {
  id: string
  companyId: string | null
  periodFrom: string
  periodTo: string
  summaryJson: AnalyticsContext
  aiText: string
  status: 'generated' | 'failed'
  errorMessage?: string
}

/**
 * Generate weekly digest for a company
 */
export async function generateWeeklyDigest(
  companyId?: string
): Promise<WeeklyDigestResult> {
  if (!supabase) {
    throw new Error('Supabase client not initialized')
  }

  // Calculate last 7 days period (Asia/Jerusalem timezone)
  const today = new Date()
  const periodTo = today.toISOString().split('T')[0] // YYYY-MM-DD
  const periodFromDate = new Date(today)
  periodFromDate.setDate(periodFromDate.getDate() - 7)
  const periodFrom = periodFromDate.toISOString().split('T')[0]

  const period: AnalyticsPeriod = {
    from: periodFrom,
    to: periodTo,
    tz: DEFAULT_TIMEZONE as typeof DEFAULT_TIMEZONE,
  }

  try {
    // 1. Build analytics context
    const context = await buildAnalyticsContext({
      mode: 'manager',
      period,
      companyId,
    })

    // 2. Generate AI text
    const systemPrompt = selectSystemPrompt('manager')
    const userPrompt = `Сформируй weekly digest за период ${periodFrom} - ${periodTo}.

Включи:
1. Краткое резюме (2-3 предложения)
2. Ключевые метрики по лидам, сделкам и финансам
3. Top 3 проблемы из данных
4. 3-5 конкретных рекомендаций на следующую неделю

Формат: структурированный текст, легко читаемый. Без воды.`

    const contextJson = JSON.stringify(context, null, 0)
    const llmResponse = await callLLM({
      systemPrompt,
      userMessage: userPrompt,
      contextData: contextJson,
      temperature: 0.7,
      maxTokens: 2000,
    })

    if (llmResponse.error) {
      throw new Error(`LLM error: ${llmResponse.error}`)
    }

    // 3. Save to database
    const { data, error } = await supabase
      .from('weekly_digests')
      .insert({
        company_id: companyId || null,
        period_from: periodFrom,
        period_to: periodTo,
        summary_json: context,
        ai_text: llmResponse.content,
        status: 'generated',
      })
      .select()
      .single()

    if (error) {
      // If duplicate, update existing
      if (error.code === '23505') { // Unique violation
        const { data: updated, error: updateError } = await supabase
          .from('weekly_digests')
          .update({
            summary_json: context,
            ai_text: llmResponse.content,
            status: 'generated',
            error_message: null,
          })
          .eq('company_id', companyId || null)
          .eq('period_from', periodFrom)
          .eq('period_to', periodTo)
          .select()
          .single()

        if (updateError) {
          throw new Error(`Failed to update digest: ${updateError.message}`)
        }

        return {
          id: updated.id,
          companyId: updated.company_id,
          periodFrom: updated.period_from,
          periodTo: updated.period_to,
          summaryJson: updated.summary_json as AnalyticsContext,
          aiText: updated.ai_text,
          status: updated.status as 'generated' | 'failed',
        }
      }

      throw new Error(`Failed to save digest: ${error.message}`)
    }

    return {
      id: data.id,
      companyId: data.company_id,
      periodFrom: data.period_from,
      periodTo: data.period_to,
      summaryJson: data.summary_json as AnalyticsContext,
      aiText: data.ai_text,
      status: data.status as 'generated' | 'failed',
    }
  } catch (error: any) {
    // Save failed digest (if not already saved)
    if (supabase) {
      try {
        const { data: existing } = await supabase
          .from('weekly_digests')
          .select('id')
          .eq('company_id', companyId || null)
          .eq('period_from', periodFrom)
          .eq('period_to', periodTo)
          .single()

        if (!existing) {
          await supabase
            .from('weekly_digests')
            .insert({
              company_id: companyId || null,
              period_from: periodFrom,
              period_to: periodTo,
              summary_json: {},
              ai_text: '',
              status: 'failed',
              error_message: error.message?.substring(0, 500),
            })
        } else {
          // Update existing to failed status
          await supabase
            .from('weekly_digests')
            .update({
              status: 'failed',
              error_message: error.message?.substring(0, 500),
            })
            .eq('id', existing.id)
        }
      } catch (saveError) {
        // Ignore save errors - we'll throw original error
        console.error('[Weekly Digest] Failed to save error record:', saveError)
      }
    }

    throw error
  }
}

/**
 * Get weekly digests for a company
 */
export async function getWeeklyDigests(
  companyId?: string,
  limit: number = 20
): Promise<WeeklyDigestResult[]> {
  if (!supabase) {
    throw new Error('Supabase client not initialized')
  }

  let query = supabase
    .from('weekly_digests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch digests: ${error.message}`)
  }

  return (data || []).map((d) => ({
    id: d.id,
    companyId: d.company_id,
    periodFrom: d.period_from,
    periodTo: d.period_to,
    summaryJson: d.summary_json as AnalyticsContext,
    aiText: d.ai_text,
    status: d.status as 'generated' | 'failed',
    errorMessage: d.error_message,
  }))
}

/**
 * Get single weekly digest by ID
 */
export async function getWeeklyDigest(id: string): Promise<WeeklyDigestResult | null> {
  if (!supabase) {
    throw new Error('Supabase client not initialized')
  }

  const { data, error } = await supabase
    .from('weekly_digests')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') { // Not found
      return null
    }
    throw new Error(`Failed to fetch digest: ${error.message}`)
  }

  return {
    id: data.id,
    companyId: data.company_id,
    periodFrom: data.period_from,
    periodTo: data.period_to,
    summaryJson: data.summary_json as AnalyticsContext,
    aiText: data.ai_text,
    status: data.status as 'generated' | 'failed',
    errorMessage: data.error_message,
  }
}

