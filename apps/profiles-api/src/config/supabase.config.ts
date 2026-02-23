import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Service role client (admin operations, bypasses RLS)
let supabaseAdminClient: SupabaseClient;

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdminClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        "Missing Supabase environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      );
    }

    supabaseAdminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseAdminClient;
}

// User-scoped client (respects RLS policies)
export function getSupabaseUser(accessToken: string): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables: SUPABASE_URL or SUPABASE_ANON_KEY",
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Feature flag: Check if company has profiles access
export function hasProfilesAccess(companyId: string): boolean {
  const pashkovskyCompanyId = process.env.PASHKOVSKY_COMPANY_ID;

  if (!pashkovskyCompanyId) {
    console.warn(
      "PASHKOVSKY_COMPANY_ID not set - profiles access disabled for all",
    );
    return false;
  }

  return companyId === pashkovskyCompanyId;
}
