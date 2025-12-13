/**
 * Script to check if hero files are migrated to S3
 * Shows the correct S3 URL based on your environment variables
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getS3Config() {
  const envLocalPath = path.join(__dirname, '..', '.env.local')
  const envPath = path.join(__dirname, '..', '.env')
  
  let envContent = ''
  if (fs.existsSync(envLocalPath)) {
    envContent = fs.readFileSync(envLocalPath, 'utf-8')
  } else if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8')
  }

  const bucketMatch = envContent.match(/NEXT_PUBLIC_AWS_S3_BUCKET_NAME=(.+)/) || 
                      envContent.match(/AWS_S3_BUCKET_NAME=(.+)/)
  const regionMatch = envContent.match(/NEXT_PUBLIC_AWS_S3_REGION=(.+)/) || 
                      envContent.match(/AWS_S3_REGION=(.+)/)

  const bucket = bucketMatch ? bucketMatch[1].trim() : null
  const region = regionMatch ? regionMatch[1].trim() : null

  return { bucket, region }
}

function getHeroFiles() {
  const heroDir = path.join(__dirname, '..', 'public', 'hero')
  if (!fs.existsSync(heroDir)) {
    return []
  }

  const files = fs.readdirSync(heroDir)
  return files.filter(f => {
    const filePath = path.join(heroDir, f)
    return fs.statSync(filePath).isFile()
  })
}

async function main() {
  console.log('🔍 Checking hero files migration status...\n')

  const s3Config = getS3Config()
  const heroFiles = getHeroFiles()

  if (!s3Config.bucket || !s3Config.region) {
    console.log('❌ S3 is not configured!')
    console.log('   Set NEXT_PUBLIC_AWS_S3_BUCKET_NAME and NEXT_PUBLIC_AWS_S3_REGION')
    process.exit(1)
  }

  console.log('📦 S3 Configuration:')
  console.log(`   Bucket: ${s3Config.bucket}`)
  console.log(`   Region: ${s3Config.region}`)
  console.log(`   Base URL: https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com\n`)

  if (heroFiles.length === 0) {
    console.log('ℹ️  No files found in public/hero/')
    console.log('   Hero folder might already be deleted or empty.')
  } else {
    console.log(`📁 Found ${heroFiles.length} files in public/hero/:\n`)
    
    heroFiles.forEach(file => {
      const s3Url = `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com/hero/${file}`
      console.log(`   📄 ${file}`)
      console.log(`      Local: /hero/${file}`)
      console.log(`      S3:    ${s3Url}`)
      console.log('')
    })

    console.log('='.repeat(60))
    console.log('📋 Migration Checklist:')
    console.log('')
    console.log('1. Upload hero files to S3:')
    console.log(`   s3://${s3Config.bucket}/hero/`)
    console.log('')
    console.log('2. Test URLs in browser:')
    heroFiles.forEach(file => {
      const s3Url = `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com/hero/${file}`
      console.log(`   ${s3Url}`)
    })
    console.log('')
    console.log('3. After confirming files are accessible in S3, you can delete:')
    console.log('   npm run delete:public-images')
    console.log('='.repeat(60))
  }
}

main().catch(console.error)

