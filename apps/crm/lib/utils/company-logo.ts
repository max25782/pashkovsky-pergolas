/**
 * Company Logo Helper
 * Retrieve company logo URL from database
 */

import { createClient } from '@supabase/supabase-js'

export async function getCompanyLogo(companyId: string): Promise<string | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data, error } = await supabase
      .from('companies')
      .select('logo_url')
      .eq('id', companyId)
      .single()

    if (error || !data) {
      console.error('[Get Company Logo] Error:', error)
      return null
    }

    return data.logo_url
  } catch (error) {
    console.error('[Get Company Logo] Exception:', error)
    return null
  }
}

export async function getCompanyProfile(companyId: string) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    if (error || !data) {
      console.error('[Get Company Profile] Error:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('[Get Company Profile] Exception:', error)
    return null
  }
}

