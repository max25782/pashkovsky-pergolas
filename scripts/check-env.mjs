/**
 * Script to check and fix environment variables
 * Run: node scripts/check-env.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envPath = path.join(__dirname, '..', '.env')
const envLocalPath = path.join(__dirname, '..', '.env.local')

function checkEnvFile(filePath, name) {
  if (!fs.existsSync(filePath)) {
    console.log(`❌ ${name} does not exist`)
    return null
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  const hasBucket = content.includes('NEXT_PUBLIC_AWS_S3_BUCKET_NAME')
  const hasRegion = content.includes('NEXT_PUBLIC_AWS_S3_REGION')
  
  console.log(`\n📄 ${name}:`)
  console.log(`   NEXT_PUBLIC_AWS_S3_BUCKET_NAME: ${hasBucket ? '✅' : '❌'}`)
  console.log(`   NEXT_PUBLIC_AWS_S3_REGION: ${hasRegion ? '✅' : '❌'}`)
  
  if (hasBucket && hasRegion) {
    const bucketMatch = content.match(/NEXT_PUBLIC_AWS_S3_BUCKET_NAME=(.+)/)
    const regionMatch = content.match(/NEXT_PUBLIC_AWS_S3_REGION=(.+)/)
    if (bucketMatch && regionMatch) {
      console.log(`   Bucket: ${bucketMatch[1].trim()}`)
      console.log(`   Region: ${regionMatch[1].trim()}`)
    }
  }
  
  return { hasBucket, hasRegion, content }
}

async function main() {
  console.log('🔍 Checking environment files...\n')
  
  const env = checkEnvFile(envPath, '.env')
  const envLocal = checkEnvFile(envLocalPath, '.env.local')
  
  console.log('\n' + '='.repeat(50))
  
  if (!env && !envLocal) {
    console.log('❌ No environment files found!')
    console.log('\nCreate .env.local with:')
    console.log('NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery')
    console.log('NEXT_PUBLIC_AWS_S3_REGION=eu-north-1')
    return
  }
  
  const hasConfig = (env && env.hasBucket && env.hasRegion) || 
                    (envLocal && envLocal.hasBucket && envLocal.hasRegion)
  
  if (!hasConfig) {
    console.log('⚠️  Missing NEXT_PUBLIC_ variables!')
    console.log('\nAdd to .env.local:')
    console.log('NEXT_PUBLIC_AWS_S3_BUCKET_NAME=pashkovsky-gallery')
    console.log('NEXT_PUBLIC_AWS_S3_REGION=eu-north-1')
  } else {
    console.log('✅ Environment variables are configured!')
    console.log('\n⚠️  Important: Restart dev server after changing .env files!')
    console.log('   Run: npm run dev')
  }
  
  console.log('='.repeat(50))
}

main().catch(console.error)


