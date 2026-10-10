import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { allocateOfferNumber } from '@/lib/offers/allocate-offer-number'
import { readIntegrationEnv, SKIP_MESSAGE_SUPABASE } from '../../../tests/helpers/integration-guard'

// Throws before any network call when the configured URL is not local.
const env = readIntegrationEnv()
const describeIfLocalSupabase = env ? describe : describe.skip
if (!env) console.warn(`[allocate-offer-number.race] ${SKIP_MESSAGE_SUPABASE}`)

describeIfLocalSupabase('allocateOfferNumber concurrency', () => {
  // describe.skip still runs this callback, so nothing is created until a hook runs.
  let supabase: SupabaseClient
  let companyId: string

  beforeAll(async () => {
    supabase = createClient(env!.url, env!.serviceKey, { db: { schema: 'public' } })
    const { data, error } = await supabase.from('companies').select('id').limit(1).single()
    if (error || !data) throw new Error('Need at least one company for race test')
    companyId = data.id as string
  })

  it('returns 20 unique numbers under parallel allocation', async () => {
    const year = 2099
    const results = await Promise.all(
      Array.from({ length: 20 }, () => allocateOfferNumber(supabase, companyId, year)),
    )
    const unique = new Set(results)
    expect(unique.size).toBe(20)
    for (const n of results) {
      expect(n.startsWith(`${year}-`)).toBe(true)
    }
  })
})
