import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { allocateOfferNumber } from '../lib/offers/allocate-offer-number'

config({ path: resolve(__dirname, '../.env.local') })

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing Supabase env')
  process.exit(1)
}

async function main() {
  const supabase = createClient(url!, key!)
  const { data, error } = await supabase.from('companies').select('id').limit(1).single()
  if (error || !data) throw error
  const companyId = data.id as string
  const year = 2099
  const results = await Promise.all(
    Array.from({ length: 20 }, () => allocateOfferNumber(supabase, companyId, year)),
  )
  const unique = new Set(results)
  console.log('allocated', results.length, 'unique', unique.size)
  if (unique.size !== 20) {
    console.error('DUPLICATE', results)
    process.exit(1)
  }
  console.log('OK', results.slice(0, 3).join(', '), '...')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
