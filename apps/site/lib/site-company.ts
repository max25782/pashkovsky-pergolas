const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Marketing-site tenant. Set NEXT_PUBLIC_SITE_COMPANY_ID to that company's id. */
export function getSiteCompanyId(): string | null {
  const id = process.env.NEXT_PUBLIC_SITE_COMPANY_ID?.trim()
  if (!id || !UUID_RE.test(id)) return null
  return id
}

export function siteCompanyPrefix(companyId: string): string {
  return `images/${companyId}/`
}
