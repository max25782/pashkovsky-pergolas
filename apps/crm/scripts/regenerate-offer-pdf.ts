/**
 * Regenerate offer PDF locally: npx tsx scripts/regenerate-offer-pdf.ts <offerId> [locale]
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { writeFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { transformOfferFromDbRow } from '../lib/pdf/map-offer-db-row-for-pdf'
import { generateOfferPdf } from '../lib/pdf/generate-offer-pdf'
import { renderOfferHtml } from '../lib/pdf/offer-html-template'

config({ path: resolve(__dirname, '../.env.local') })

const offerId = process.argv[2]
const locale = process.argv[3] ?? 'he'

if (!offerId) {
  console.error('Usage: npx tsx scripts/regenerate-offer-pdf.ts <offerId> [locale]')
  process.exit(1)
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url!, key!)

async function main() {
  const { data, error } = await supabase.from('offers').select('*').eq('id', offerId).single()
  if (error || !data) {
    console.error('Offer not found:', error?.message)
    process.exit(1)
  }
  const offer = transformOfferFromDbRow(data as Record<string, unknown>)
  const outDir = resolve(__dirname, '../../../docs/pdf-regenerated')
  const htmlPath = resolve(outDir, `${offerId}.html`)
  const pdfPath = resolve(outDir, `${offerId}.pdf`)
  const html = await renderOfferHtml(offer, null, true, locale)
  writeFileSync(htmlPath, html, 'utf8')
  console.log('Wrote', htmlPath)
  const pdf = await generateOfferPdf(offer, locale)
  writeFileSync(pdfPath, pdf)
  console.log('Wrote', pdfPath, `(${pdf.length} bytes)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
