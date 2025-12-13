/**
 * Script to migrate hero files from public/hero to S3
 * Uses the same S3 upload logic as migrate-public-images-to-s3.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME || process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME
const S3_REGION = process.env.AWS_S3_REGION || process.env.NEXT_PUBLIC_AWS_S3_REGION || 'us-east-1'
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY

if (!S3_BUCKET || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  console.error('❌ Missing S3 credentials!')
  console.error('   Required: AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY')
  process.exit(1)
}

const s3Client = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
})

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase()
  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

async function uploadToS3(buffer, key, mimeType) {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  })

  await s3Client.send(command)
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`
}

async function migrateHeroFiles() {
  console.log('🚀 Starting migration of public/hero to S3...')
  console.log(`📦 S3 Bucket: ${S3_BUCKET}`)
  console.log(`🌍 Region: ${S3_REGION}`)
  console.log('')

  const heroDir = path.join(__dirname, '..', 'public', 'hero')

  if (!fs.existsSync(heroDir)) {
    console.error('❌ public/hero directory not found')
    process.exit(1)
  }

  const files = fs.readdirSync(heroDir).filter(file => {
    const filePath = path.join(heroDir, file)
    return fs.statSync(filePath).isFile()
  })

  if (files.length === 0) {
    console.log('ℹ️  No files found in public/hero')
    return
  }

  console.log(`📸 Found ${files.length} files to migrate\n`)

  let successCount = 0
  let errorCount = 0
  const errors = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const progress = `[${i + 1}/${files.length}]`
    const filePath = path.join(heroDir, file)

    try {
      const buffer = fs.readFileSync(filePath)
      const mimeType = getMimeType(file)
      const s3Key = `hero/${file}`

      console.log(`${progress} Uploading: ${file}`)

      const s3Url = await uploadToS3(buffer, s3Key, mimeType)

      console.log(`✅ ${progress} Success: ${file}`)
      console.log(`   URL: ${s3Url}\n`)
      successCount++

    } catch (error) {
      console.error(`❌ ${progress} Failed: ${file}`)
      console.error(`   Error: ${error.message}\n`)
      errorCount++
      errors.push({ file, error: error.message })
    }
  }

  console.log('='.repeat(50))
  console.log('📊 Migration Summary:')
  console.log(`   ✅ Success: ${successCount}`)
  console.log(`   ❌ Failed: ${errorCount}`)
  console.log(`   📈 Total: ${files.length}`)
  console.log('='.repeat(50))

  if (errors.length > 0) {
    console.log('')
    console.log('❌ Errors:')
    errors.forEach(({ file, error }) => {
      console.log(`   - ${file}: ${error}`)
    })
  }

  if (successCount > 0) {
    console.log('')
    console.log('✅ Hero files migrated successfully!')
    console.log('   You can now delete public/hero/ folder')
    console.log('   Run: npm run delete:public-images')
  }
}

migrateHeroFiles().catch(console.error)


