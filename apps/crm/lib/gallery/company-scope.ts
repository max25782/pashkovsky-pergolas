import { NextResponse } from 'next/server'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** Require company_id from a public request query string. */
export function parsePublicCompanyId(
  searchParams: URLSearchParams,
): { companyId: string } | { error: NextResponse } {
  const companyId = searchParams.get('company_id')
  if (!isUuid(companyId)) {
    return {
      error: NextResponse.json(
        { error: 'company_id query parameter is required' },
        { status: 400 },
      ),
    }
  }
  return { companyId }
}

export function companyGalleryPrefix(companyId: string): string {
  return `images/${companyId}/`
}

/**
 * Force S3/media listing under images/{companyId}/.
 * Bare images/ is remapped; any other prefix outside the company root is rejected.
 */
export function resolveCompanyMediaPrefix(
  companyId: string,
  requested: string | null,
): { prefix: string } | { error: NextResponse } {
  const companyRoot = companyGalleryPrefix(companyId)
  const raw = (requested ?? companyRoot).trim() || companyRoot

  if (raw !== 'images' && raw !== 'images/' && !raw.startsWith('images/')) {
    return {
      error: NextResponse.json(
        { error: 'Prefix must start with images/' },
        { status: 400 },
      ),
    }
  }

  if (raw === 'images' || raw === 'images/') {
    return { prefix: companyRoot }
  }

  if (!raw.startsWith(companyRoot)) {
    return {
      error: NextResponse.json(
        { error: 'Prefix is outside your company media root' },
        { status: 403 },
      ),
    }
  }

  return { prefix: raw }
}

/** Reject tagging/uploading keys that escape the company media root. */
export function assertCompanyStorageKey(
  companyId: string,
  key: string,
): { ok: true } | { error: NextResponse } {
  const companyRoot = companyGalleryPrefix(companyId)
  if (!key.startsWith(companyRoot)) {
    return {
      error: NextResponse.json(
        { error: 'Storage key is outside your company media root' },
        { status: 403 },
      ),
    }
  }
  return { ok: true }
}

export function buildCompanyGalleryStoragePath(
  companyId: string,
  categoryKey: string,
  filename: string,
  folderName?: string,
): string {
  const base = `${companyGalleryPrefix(companyId)}${categoryKey}`
  if (folderName) return `${base}/${folderName}/${filename}`
  return `${base}/${filename}`
}
