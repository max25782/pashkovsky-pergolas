export interface CompanyMembershipRow {
  company_id: string;
  role: string | null;
  joined_at: string | null;
}

/**
 * Picks the tenant for this request: header wins, then query param, then newest membership.
 */
export function pickActiveCompanyId(
  memberships: CompanyMembershipRow[],
  headerCompanyId: string | undefined,
  queryCompanyId: string | undefined,
): { companyId: string | null; role: string | null } {
  const ids = new Set(memberships.map((m) => m.company_id));
  const header = headerCompanyId?.trim();
  if (header && ids.has(header)) {
    const row = memberships.find((m) => m.company_id === header);
    return { companyId: header, role: row?.role ?? null };
  }
  const query = queryCompanyId?.trim();
  if (query && ids.has(query)) {
    const row = memberships.find((m) => m.company_id === query);
    return { companyId: query, role: row?.role ?? null };
  }
  if (memberships.length > 0) {
    const row = memberships[0];
    return { companyId: row.company_id, role: row.role };
  }
  return { companyId: null, role: null };
}
