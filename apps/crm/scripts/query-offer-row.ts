import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(__dirname, '../.env.local') })

const id = process.argv[2]
if (!id) {
  console.error('usage: query-offer-row <offerId>')
  process.exit(1)
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) process.exit(1)

async function main() {
  const sb = createClient(url!, key!)
  const { data, error } = await sb
    .from('offers')
    .select('id, customer_name, offer_number, terms_snapshot, created_at')
    .eq('id', id)
    .single()
  if (error) throw error
  console.log(JSON.stringify(data, null, 2))
}

main()
