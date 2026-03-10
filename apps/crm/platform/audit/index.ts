/**
 * platform/audit — Audit Logging
 *
 * Canonical import path for all audit/logging utilities.
 * New code should import from '@/platform/audit'.
 */

// Resource & auth audit logger (writes to audit_logs table)
export {
  logAuditEvent,
  logAuthEvent,
  logResourceEvent,
  logDealEvent,
  logLeadEvent,
  type AuditLogEntry,
} from '@/lib/audit/logger'

// Platform-level event logger (writes to platform_audit_logs table)
export {
  logPlatformEvent,
  getRecentActivity,
  type PlatformEventType,
} from '@/lib/audit/platform-logs'
