import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Load an ai_sessions row only if it belongs to companyId.
 * Returns null when missing or owned by another company (caller maps to 404).
 */
export async function getOwnedAiSession(
  supabase: SupabaseClient,
  sessionId: string,
  companyId: string,
): Promise<{ id: string; client_id: string; company_id: string } | null> {
  const { data } = await supabase
    .from('ai_sessions')
    .select('id, client_id, company_id')
    .eq('id', sessionId)
    .eq('company_id', companyId)
    .maybeSingle()

  return data ?? null
}

/**
 * Load an ai_director_sessions row only if it belongs to companyId.
 */
export async function getOwnedDirectorSession(
  supabase: SupabaseClient,
  sessionId: string,
  companyId: string,
): Promise<{ id: string } | null> {
  const { data } = await supabase
    .from('ai_director_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('company_id', companyId)
    .maybeSingle()

  return data ?? null
}

export function sessionNotFoundResponse(): NextResponse {
  return NextResponse.json({ error: 'Session not found' }, { status: 404 })
}

export function companyRequiredResponse(): NextResponse {
  return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
}
