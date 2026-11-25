/**
 * Company storage quota.
 * Limit: subscription_plans.limits.storage_mb (via try_consume_storage_mb).
 * Usage: company_usage.storage_used_mb.
 * A missing function (migration 072 not applied yet) does not block the upload;
 * the caller logs it. A configured limit that would be exceeded blocks.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const STORAGE_QUOTA_EXCEEDED = 'Storage quota exceeded'

export interface StorageQuotaResult {
  ok: boolean
  error?: string
  usedMb: number | null
  limitMb: number | null
  /** True when the quota function is not installed yet. */
  unchecked: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

export function bytesToMb(bytes: number): number {
  return bytes / (1024 * 1024)
}

export function parseQuotaPayload(data: unknown): StorageQuotaResult {
  const row = asRecord(data)
  if (!row) {
    return { ok: false, error: 'Storage quota check failed', usedMb: null, limitMb: null, unchecked: false }
  }
  const ok = row.ok === true
  return {
    ok,
    error: ok ? undefined : STORAGE_QUOTA_EXCEEDED,
    usedMb: asNumber(row.used_mb),
    limitMb: asNumber(row.limit_mb),
    unchecked: false,
  }
}

export async function consumeStorageBytes(
  db: SupabaseClient,
  companyId: string,
  deltaBytes: number,
): Promise<StorageQuotaResult> {
  if (!companyId || !Number.isFinite(deltaBytes) || deltaBytes === 0) {
    return { ok: true, usedMb: null, limitMb: null, unchecked: false }
  }

  const { data, error } = await db.rpc('try_consume_storage_mb', {
    p_company_id: companyId,
    p_delta_mb: bytesToMb(deltaBytes),
  })

  if (error) {
    const code = 'code' in error ? String(error.code) : ''
    const message = error.message ?? ''
    const missing =
      code === '42883' ||
      code === 'PGRST202' ||
      message.toLowerCase().includes('try_consume_storage_mb')
    if (missing) {
      console.warn('[storage-quota] try_consume_storage_mb is not installed; upload is not quota-checked')
      return { ok: true, usedMb: null, limitMb: null, unchecked: true }
    }
    console.error('[storage-quota] quota call failed', { code })
    return { ok: false, error: 'Storage quota check failed', usedMb: null, limitMb: null, unchecked: false }
  }

  return parseQuotaPayload(data)
}
