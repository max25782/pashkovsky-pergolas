/**
 * Resolves which firm a public lead form belongs to.
 *
 * A lead is never saved without a company_id. The firm is taken from:
 *   1. form key (body.form_key / x-form-key / x-site-token) mapped in env, or
 *   2. the request Origin / Referer domain mapped in env.
 * If neither yields a firm, or they disagree, the request is rejected.
 *
 * Env (comma-separated `value:uuid` pairs; domains without a scheme):
 *   PUBLIC_LEAD_COMPANY_BY_FORM_KEY  form key or site token → company id
 *   PUBLIC_LEAD_COMPANY_BY_DOMAIN    hostname → company id
 * Backward compatible: CRM_SITE_TOKEN + DEFAULT_COMPANY_ID count as one form-key mapping.
 */

export interface PublicLeadCompanyInput {
  formKey?: string | null
  origin?: string | null
  referer?: string | null
  /** Env snapshot so tests do not depend on process.env mutation order. */
  env?: {
    formKeyMap?: string
    domainMap?: string
    legacySiteToken?: string
    legacyCompanyId?: string
  }
}

export type PublicLeadCompanyResult =
  | { ok: true; companyId: string; via: 'form_key' | 'domain' }
  | { ok: false; reason: 'unresolved' | 'conflict' | 'invalid_map' }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseMap(raw: string | undefined): Map<string, string> | null {
  const map = new Map<string, string>()
  if (!raw?.trim()) return map
  for (const part of raw.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const colon = trimmed.lastIndexOf(':')
    if (colon <= 0) return null
    const key = trimmed.slice(0, colon).trim().toLowerCase()
    const companyId = trimmed.slice(colon + 1).trim()
    if (!key || !UUID_RE.test(companyId)) return null
    map.set(key, companyId)
  }
  return map
}

export function hostnameFromUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  try {
    const host = new URL(value).hostname.toLowerCase()
    return host || null
  } catch {
    return null
  }
}

function buildFormKeyMap(env: NonNullable<PublicLeadCompanyInput['env']>): Map<string, string> | null {
  const map = parseMap(env.formKeyMap)
  if (map === null) return null
  const token = env.legacySiteToken?.trim()
  const companyId = env.legacyCompanyId?.trim()
  if (token && companyId) {
    if (!UUID_RE.test(companyId)) return null
    map.set(token.toLowerCase(), companyId)
  }
  return map
}

/**
 * Pure: picks the firm for a public lead, or explains why the request must be rejected.
 */
export function resolvePublicLeadCompany(input: PublicLeadCompanyInput): PublicLeadCompanyResult {
  const env = {
    formKeyMap: input.env?.formKeyMap ?? process.env.PUBLIC_LEAD_COMPANY_BY_FORM_KEY,
    domainMap: input.env?.domainMap ?? process.env.PUBLIC_LEAD_COMPANY_BY_DOMAIN,
    legacySiteToken: input.env?.legacySiteToken ?? process.env.CRM_SITE_TOKEN,
    legacyCompanyId: input.env?.legacyCompanyId ?? process.env.DEFAULT_COMPANY_ID,
  }

  const formKeyMap = buildFormKeyMap(env)
  const domainMap = parseMap(env.domainMap)
  if (formKeyMap === null || domainMap === null) return { ok: false, reason: 'invalid_map' }

  const formKey = input.formKey?.trim().toLowerCase() || null
  const fromKey = formKey ? formKeyMap.get(formKey) ?? null : null

  const host =
    hostnameFromUrl(input.origin) ?? hostnameFromUrl(input.referer)
  const fromDomain = host ? domainMap.get(host) ?? null : null

  if (fromKey && fromDomain && fromKey !== fromDomain) return { ok: false, reason: 'conflict' }
  if (fromKey) return { ok: true, companyId: fromKey, via: 'form_key' }
  if (fromDomain) return { ok: true, companyId: fromDomain, via: 'domain' }
  return { ok: false, reason: 'unresolved' }
}
