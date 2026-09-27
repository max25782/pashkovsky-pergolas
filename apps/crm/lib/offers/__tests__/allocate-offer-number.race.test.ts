import { createClient } from '@supabase/supabase-js'
import { allocateOfferNumber } from '@/lib/offers/allocate-offer-number'

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

const describeIfSupabase = url && key ? describe : describe.skip

describeIfSupabase('allocateOfferNumber concurrency', () => {
  const supabase = createClient(url!, key!, { db: { schema: 'public' } })
  let companyId: string

  beforeAll(async () => {
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
