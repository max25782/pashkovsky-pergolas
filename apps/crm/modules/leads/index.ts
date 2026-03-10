/**
 * modules/leads — Lead Management
 *
 * Canonical import path for all leads-related code.
 * New code should import from '@/modules/leads'.
 *
 * Responsibilities:
 *   - Lead intake & validation
 *   - Lead listing, filtering, assignment
 *   - Lead scoring (rules + AI)
 *   - Conversion to deal
 */

// Types
export {
  type Lead,
  LEAD_STATUSES,
} from '@/components/admin/lead-types'

// API client (client-side fetch helpers)
export {
  fetchLeads,
  updateLead,
  deleteLead,
} from '@/components/admin/lead-api'

// Scoring engine
export {
  scoreLeadRules,
  buildLeadAiScoringContext,
  scoreLeadAI,
  mergeScores,
  getScoreCategory,
  scoreLead,
  type ScoringRuleResult,
  type ScoringAIResult,
  type ScoringResult,
  type LeadScoringContext,
} from '@/lib/leads/scoring'

// Public lead validation schema
export {
  PublicLeadSchema,
  type PublicLeadInput,
} from '@/lib/validation/public-lead'

// React hooks
export { useLeads } from '@/components/admin/hooks/useLeads'
export { useLeadActions } from '@/components/admin/hooks/useLeadActions'

// UI Components
export { default as LeadCard } from '@/components/admin/LeadCard'
export { default as LeadModal } from '@/components/admin/LeadModal'
export { default as LeadsTable } from '@/components/admin/LeadsTable'
export { default as LeadsTableView } from '@/components/admin/LeadsTableView'
export { default as LeadsHeader } from '@/components/admin/LeadsHeader'
export { default as LeadScore } from '@/components/admin/LeadScore'
