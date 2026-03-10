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
export { LeadCard } from '@/components/admin/LeadCard'
export { LeadModal } from '@/components/admin/LeadModal'
export { LeadsTable } from '@/components/admin/LeadsTable'
export { LeadsTableView } from '@/components/admin/LeadsTableView'
export { LeadsHeader } from '@/components/admin/LeadsHeader'
export { LeadScore } from '@/components/admin/LeadScore'
