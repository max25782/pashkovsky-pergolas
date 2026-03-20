/**
 * Server-side Supabase URL: prefer SUPABASE_URL, fall back to NEXT_PUBLIC_SUPABASE_URL
 * (many deployments only set the public var).
 */
export function getSupabaseUrlForServiceRole(): string | undefined {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  return url?.trim() || undefined
}
