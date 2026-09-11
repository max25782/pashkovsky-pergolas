/**
 * platform/ai — AI Clients, Prompts & Chat
 *
 * Canonical import path for all AI-related utilities.
 * New code should import from '@/platform/ai'.
 */

// Generic LLM client (Gemini/Google AI)
export {
  callLLM,
  type CallLLMParams,
  type LLMResponse,
} from '@/lib/ai/client'

// Bedrock Agent client
export {
  callBedrockAgent,
  isBedrockConfigured,
  type BedrockCallParams,
  type BedrockResponse,
} from '@/lib/ai/bedrock-client'

// Analytics prompts
export {
  LEADS_ANALYST_PROMPT,
  DEALS_ANALYST_PROMPT,
  FINANCE_ANALYST_PROMPT,
  MANAGER_ANALYST_PROMPT,
  selectSystemPrompt,
} from '@/lib/ai/prompts'

// Analytics types
export {
  DEFAULT_VAT_PERCENT,
  DEFAULT_TIMEZONE,
  type AnalyticsMode,
  type AnalyticsPeriod,
  type LeadsAnalyticsSummary,
  type DealsAnalyticsSummary,
  type FinanceAnalyticsSummary,
  type WorkforceAnalyticsSummary,
  type AnalyticsContext,
  type BuildAnalyticsContextParams as AnalyticsContextParams,
  type AnalyticsContextResponse,
} from '@/lib/ai/analyticsTypes'

// Analytics context builder
export {
  buildAnalyticsContext,
  type BuildAnalyticsContextParams,
} from '@/lib/ai/buildAnalyticsContext'

// AI Chat config & system prompt
export {
  SYSTEM_PROMPT,
  fewShotExamples,
  AI_CONFIG,
  SAFE_FALLBACK_REPLY,
  COOKIE_NAME,
  COOKIE_MAX_AGE,
} from '@/lib/ai-chat/config'

// Guarded sales-chat completion. Always use this instead of calling Gemini with
// SYSTEM_PROMPT directly: it applies the prompt as systemInstruction and blocks
// leaked reasoning from reaching the customer.
export {
  generateSalesReply,
  type SalesReply,
  type GeminiImageData,
  type HistoryMessage,
} from '@/lib/ai-chat/gemini-client'

// Outgoing-reply guards
export {
  stripThoughtBlock,
  inspectResponse,
  sanitizeAndInspect,
  shouldPersistReply,
  type LeakCheckResult,
} from '@/lib/ai-chat/response-sanitizer'

// Appointment detection
export {
  isAppointmentConfirmation,
  isCallbackConfirmation,
  extractAppointment,
  type AppointmentData,
} from '@/lib/ai-chat/appointment-detector'

// XSS sanitization for AI output
export {
  sanitizeInput,
  sanitizeForDisplay,
} from '@/lib/ai-chat/xss-filter'

// Image fetcher for AI chat
export { fetchImagesByContext } from '@/lib/ai-chat/image-fetcher'

// Calendar invite generation
export { generateICS, sendCalendarInvite, sendCallbackRequest } from '@/lib/ai-chat/calendar-invite'
