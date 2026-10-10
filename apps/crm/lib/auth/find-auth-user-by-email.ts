import type { SupabaseClient } from '@supabase/supabase-js'

const PAGE_SIZE = 1000
/** Hard stop so a misbehaving API can never spin forever (1000 * 200 = 200k users). */
const MAX_PAGES = 200

export interface AuthUserRef {
  id: string
  email: string
}

export class AuthUserLookupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthUserLookupError'
  }
}

/**
 * Exact (case-insensitive) email lookup in auth.users via the Admin API.
 *
 * The Admin API has no get-by-email in supabase-js v2, and `listUsers()` without
 * arguments only returns the first page (50 users), so a plain `find` silently
 * misses everyone else. We page through the full list and fail CLOSED: any API
 * error or an exhausted page budget throws instead of reporting "not found".
 */
export async function findAuthUserByEmail(
  admin: Pick<SupabaseClient, 'auth'>,
  email: string,
): Promise<AuthUserRef | null> {
  const wanted = email.trim().toLowerCase()

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE })
    if (error) throw new AuthUserLookupError(`listUsers failed on page ${page}: ${error.message}`)

    const users = data?.users ?? []
    const hit = users.find((u) => u.email?.toLowerCase() === wanted)
    if (hit) return { id: hit.id, email: hit.email ?? wanted }

    if (users.length < PAGE_SIZE) return null
  }

  throw new AuthUserLookupError(`listUsers exceeded ${MAX_PAGES} pages; refusing to guess`)
}
