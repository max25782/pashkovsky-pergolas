/**
 * Lead Scoring Module
 * 
 * Hybrid scoring: deterministic rules + AI adjustment
 * AI can only adjust score by +/-10 from rule score
 */

import type { Lead } from '@/components/admin/lead-types'
import { callLLM } from '@/lib/ai/client'

// ============================================================================
// Types
// ============================================================================

export interface ScoringRuleResult {
  scoreRule: number // 0-100
  reasons: string[]
}

export interface ScoringAIResult {
  scoreDelta: number // -10 to +10
  aiReasons: string[]
  suggestedNextAction: string
}

export interface ScoringResult {
  finalScore: number // 0-100
  ruleScore: number
  aiDelta: number
  reasons: string[]
  aiReasons: string[]
  suggestedNextAction: string
  breakdown: {
    rule: ScoringRuleResult
    ai?: ScoringAIResult
  }
}

export interface LeadScoringContext {
  id: string
  source: string | null
  createdAt: string | null
  hasPhone: boolean
  hasName: boolean
  hasCity: boolean
  hasEmail: boolean
  messageLength: number
  city: string | null
  status: string | null
  isDuplicate: boolean
  responseTimeMinutes: number | null
  hasAttachments: boolean
  requestedProduct: string | null // extracted from notes
}

// ============================================================================
// Rule-based Scoring
// ============================================================================

const MAX_RULE_SCORE = 100
const AI_ADJUSTMENT_LIMIT = 10

/**
 * Calculate rule-based score (deterministic)
 */
export function scoreLeadRules(lead: Lead, context?: {
  isDuplicate?: boolean
  responseTimeMinutes?: number | null
  hasAttachments?: boolean
}): ScoringRuleResult {
  let score = 0
  const reasons: string[] = []

  // Base score from source (0-25 points)
  const sourceScores: Record<string, number> = {
    'facebook': 20,
    'google': 18,
    'site': 15,
    'leadconnector': 12,
    'instagram': 10,
    'whatsapp': 8,
    'referral': 15,
  }
  
  const sourceScore = sourceScores[lead.source?.toLowerCase() || ''] || 5
  score += sourceScore
  if (lead.source) {
    reasons.push(`Источник "${lead.source}": +${sourceScore} баллов`)
  } else {
    reasons.push('Источник не указан: +5 баллов')
  }

  // Contact information completeness (0-30 points)
  if (lead.phone && lead.phone.length >= 10) {
    score += 10
    reasons.push('Есть телефон: +10 баллов')
  } else {
    reasons.push('Нет телефона или неполный: 0 баллов')
  }

  if (lead.name && lead.name.trim().length >= 2) {
    score += 10
    reasons.push('Есть имя: +10 баллов')
  } else {
    reasons.push('Нет имени: 0 баллов')
  }

  if (lead.city) {
    score += 5
    reasons.push('Указан город: +5 баллов')
  }

  if (lead.email) {
    score += 5
    reasons.push('Есть email: +5 баллов')
  }

  // Message/notes quality (0-20 points)
  const notesLength = (lead.notes || '').length
  const lastMessageLength = (lead.last_message || '').length
  const totalMessageLength = notesLength + lastMessageLength

  if (totalMessageLength > 100) {
    score += 20
    reasons.push('Подробное описание (>100 символов): +20 баллов')
  } else if (totalMessageLength > 50) {
    score += 10
    reasons.push('Есть описание (50-100 символов): +10 баллов')
  } else if (totalMessageLength > 0) {
    score += 5
    reasons.push('Короткое описание: +5 баллов')
  } else {
    reasons.push('Нет описания: 0 баллов')
  }

  // Status-based scoring (0-15 points)
  const statusScores: Record<string, number> = {
    'qualified': 15,
    'confirmed': 12,
    'contacted': 8,
    'pending': 3,
    'won': 20, // Bonus if already won
    'lost': -10, // Penalty if lost
  }
  
  const statusScore = statusScores[lead.status || 'pending'] || 0
  if (statusScore !== 0) {
    score += statusScore
    reasons.push(`Статус "${lead.status}": ${statusScore > 0 ? '+' : ''}${statusScore} баллов`)
  }

  // Recency (0-10 points)
  if (lead.created_at) {
    const daysSinceCreation = Math.floor(
      (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)
    )
    
    if (daysSinceCreation === 0) {
      score += 10
      reasons.push('Лид создан сегодня: +10 баллов')
    } else if (daysSinceCreation <= 1) {
      score += 8
      reasons.push('Лид создан вчера: +8 баллов')
    } else if (daysSinceCreation <= 3) {
      score += 5
      reasons.push('Лид создан 2-3 дня назад: +5 баллов')
    } else if (daysSinceCreation <= 7) {
      score += 2
      reasons.push('Лид создан 4-7 дней назад: +2 балла')
    } else {
      reasons.push(`Лид старый (${daysSinceCreation} дней): 0 баллов`)
    }
  }

  // Response time (0-10 points)
  if (context?.responseTimeMinutes !== null && context?.responseTimeMinutes !== undefined) {
    const responseHours = context.responseTimeMinutes / 60
    if (responseHours <= 1) {
      score += 10
      reasons.push('Быстрый ответ (<1 часа): +10 баллов')
    } else if (responseHours <= 4) {
      score += 7
      reasons.push('Ответ в течение 4 часов: +7 баллов')
    } else if (responseHours <= 24) {
      score += 4
      reasons.push('Ответ в течение дня: +4 балла')
    } else {
      reasons.push(`Медленный ответ (>24 часов): 0 баллов`)
    }
  }

  // Penalties
  if (context?.isDuplicate) {
    score -= 15
    reasons.push('Дубликат (такой же телефон): -15 баллов')
  }

  // Attachments bonus
  if (context?.hasAttachments) {
    score += 5
    reasons.push('Есть вложения/фото: +5 баллов')
  }

  // Ensure score is within bounds
  score = Math.max(0, Math.min(MAX_RULE_SCORE, score))

  return {
    scoreRule: Math.round(score),
    reasons,
  }
}

// ============================================================================
// Build Context for AI
// ============================================================================

/**
 * Build compact context for AI scoring
 */
export function buildLeadAiScoringContext(
  lead: Lead,
  ruleResult: ScoringRuleResult,
  additionalContext?: {
    isDuplicate?: boolean
    responseTimeMinutes?: number | null
    hasAttachments?: boolean
  }
): LeadScoringContext {
  const notesLength = (lead.notes || '').length
  const lastMessageLength = (lead.last_message || '').length
  
  // Extract product from notes (simple heuristic)
  let requestedProduct: string | null = null
  const notesLower = (lead.notes || '').toLowerCase()
  if (notesLower.includes('пергола') || notesLower.includes('pergola')) {
    requestedProduct = 'pergola'
  } else if (notesLower.includes('сגירת חורף') || notesLower.includes('winter')) {
    requestedProduct = 'winter_closure'
  }

  return {
    id: lead.id,
    source: lead.source || null,
    createdAt: lead.created_at || null,
    hasPhone: !!(lead.phone && lead.phone.length >= 10),
    hasName: !!(lead.name && lead.name.trim().length >= 2),
    hasCity: !!lead.city,
    hasEmail: !!lead.email,
    messageLength: notesLength + lastMessageLength,
    city: lead.city || null,
    status: lead.status || null,
    isDuplicate: additionalContext?.isDuplicate || false,
    responseTimeMinutes: additionalContext?.responseTimeMinutes || null,
    hasAttachments: additionalContext?.hasAttachments || false,
    requestedProduct,
  }
}

// ============================================================================
// AI Scoring
// ============================================================================

const AI_SCORING_PROMPT = `Ты CRM ассистент для оценки качества лидов.

Твоя задача:
1. Оценить качество лида на основе данных
2. Объяснить причины оценки
3. Предложить следующий шаг

ВАЖНО:
- У тебя есть базовый score от правил (ruleScore)
- Ты можешь скорректировать его максимум на +/-10 баллов
- НЕ придумывай факты, работай только с данными из DATA
- Если данных недостаточно, не увеличивай score

Формат ответа (JSON):
{
  "scoreDelta": -5,
  "aiReasons": ["Причина 1", "Причина 2"],
  "suggestedNextAction": "Конкретное действие"
}

scoreDelta: число от -10 до +10
aiReasons: массив строк с объяснениями
suggestedNextAction: конкретное действие (например: "Позвонить в течение 10 минут", "Запросить адрес")`

/**
 * Get AI scoring adjustment
 */
export async function scoreLeadAI(
  context: LeadScoringContext,
  ruleScore: number
): Promise<ScoringAIResult> {
  const userPrompt = `Оцени лид на основе данных:

DATA:
${JSON.stringify(context, null, 2)}

Базовый score от правил: ${ruleScore}/100

Твоя задача: скорректировать score максимум на +/-10 и объяснить почему.`

  const llmResponse = await callLLM({
    systemPrompt: AI_SCORING_PROMPT,
    userMessage: userPrompt,
    temperature: 0.3, // Lower temperature for more consistent scoring
    maxTokens: 500,
  })

  if (llmResponse.error) {
    // Fallback if AI fails
    return {
      scoreDelta: 0,
      aiReasons: ['AI scoring недоступен'],
      suggestedNextAction: 'Обработать лид стандартным способом',
    }
  }

  try {
    // Try to parse JSON from response
    const jsonMatch = llmResponse.content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const scoreDelta = Math.max(-AI_ADJUSTMENT_LIMIT, Math.min(AI_ADJUSTMENT_LIMIT, parsed.scoreDelta || 0))
      
      return {
        scoreDelta: Math.round(scoreDelta),
        aiReasons: Array.isArray(parsed.aiReasons) ? parsed.aiReasons : [parsed.aiReasons || ''],
        suggestedNextAction: parsed.suggestedNextAction || 'Обработать лид',
      }
    }
  } catch (error) {
    console.error('[Lead Scoring] Failed to parse AI response:', error)
  }

  // Fallback: try to extract delta from text
  const deltaMatch = llmResponse.content.match(/scoreDelta[:\s]+(-?\d+)/i)
  const delta = deltaMatch ? parseInt(deltaMatch[1]) : 0
  const clampedDelta = Math.max(-AI_ADJUSTMENT_LIMIT, Math.min(AI_ADJUSTMENT_LIMIT, delta))

  return {
    scoreDelta: clampedDelta,
    aiReasons: ['AI анализ выполнен, но формат ответа нестандартный'],
    suggestedNextAction: 'Обработать лид стандартным способом',
  }
}

// ============================================================================
// Merge Scores
// ============================================================================

/**
 * Merge rule score and AI adjustment
 */
export function mergeScores(ruleScore: number, aiDelta: number): number {
  const finalScore = ruleScore + aiDelta
  return Math.max(0, Math.min(100, Math.round(finalScore)))
}

/**
 * Get score category label
 */
export function getScoreCategory(score: number): string {
  if (score >= 80) return 'Hot'
  if (score >= 50) return 'Warm'
  return 'Cold'
}

// ============================================================================
// Main Scoring Function
// ============================================================================

/**
 * Score a lead (rules + AI)
 */
export async function scoreLead(
  lead: Lead,
  additionalContext?: {
    isDuplicate?: boolean
    responseTimeMinutes?: number | null
    hasAttachments?: boolean
  },
  useAI: boolean = true
): Promise<ScoringResult> {
  // 1. Rule-based scoring
  const ruleResult = scoreLeadRules(lead, additionalContext)

  // 2. AI scoring (optional)
  let aiResult: ScoringAIResult | undefined
  if (useAI) {
    const context = buildLeadAiScoringContext(lead, ruleResult, additionalContext)
    aiResult = await scoreLeadAI(context, ruleResult.scoreRule)
  } else {
    aiResult = {
      scoreDelta: 0,
      aiReasons: [],
      suggestedNextAction: 'Обработать лид стандартным способом',
    }
  }

  // 3. Merge scores
  const finalScore = mergeScores(ruleResult.scoreRule, aiResult.scoreDelta)

  return {
    finalScore,
    ruleScore: ruleResult.scoreRule,
    aiDelta: aiResult.scoreDelta,
    reasons: ruleResult.reasons,
    aiReasons: aiResult.aiReasons,
    suggestedNextAction: aiResult.suggestedNextAction,
    breakdown: {
      rule: ruleResult,
      ai: aiResult,
    },
  }
}

