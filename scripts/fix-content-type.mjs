#!/usr/bin/env node
/**
 * Fix Content-Type for all images in S3
 * This updates metadata to set correct MIME types
 */

import { S3Client, ListObjectsV2Command, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import 'dotenv/config'

const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME
const S3_REGION = process.env.AWS_S3_REGION || 'us-east-1'
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID
const AWS_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY

if (!S3_BUCKET || !AWS_ACCESS_KEY || !AWS_SECRET_KEY) {
  console.error('❌ Missing S3 configuration')
  process.exit(1)
}

const s3Client = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_KEY,
  },
})

function getContentType(filename) {
  const ext = filename.toLowerCase().split('.').pop()
  const mimeTypes = {
    'webp': 'image/webp',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo'
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

console.log('🔧 Fixing Content-Type for all images...\n')
console.log(`Bucket: ${S3_BUCKET}`)
console.log(`Region: ${S3_REGION}\n`)

let updated = 0
let skipped = 0
let errors = 0

async function processObjects(prefix) {
  const listCommand = new ListObjectsV2Command({
    Bucket: S3_BUCKET,
    Prefix: prefix,
  })
  
  const response = await s3Client.send(listCommand)
  
  if (!response.Contents || response.Contents.length === 0) {
    return
  }
  
  console.log(`📦 Found ${response.Contents.length} objects in ${prefix || 'root'}`)
  
  for (const obj of response.Contents) {
    if (!obj.Key) continue
    
    try {
      // Get current metadata
      const headCommand = new HeadObjectCommand({
        Bucket: S3_BUCKET,
        Key: obj.Key,
      })
      const head = await s3Client.send(headCommand)
      
      const correctContentType = getContentType(obj.Key)
      
      // Skip if already correct
      if (head.ContentType === correctContentType) {
        skipped++
        continue
      }
      
      // Update via copy-to-self
      const copyCommand = new CopyObjectCommand({
        Bucket: S3_BUCKET,
        Key: obj.Key,
        CopySource: `${S3_BUCKET}/${obj.Key}`,
        ContentType: correctContentType,
        ContentDisposition: 'inline',
        CacheControl: 'public, max-age=31536000, immutable',
        MetadataDirective: 'REPLACE',
      })
      
      await s3Client.send(copyCommand)
      updated++
      
      if (updated % 10 === 0) {
        console.log(`   ✅ Updated ${updated} files...`)
      }
      
    } catch (error) {
      console.error(`   ❌ Error processing ${obj.Key}:`, error.message)
      errors++
    }
  }
}

try {
  await processObjects('images/')
  
  console.log('\n📊 Summary:')
  console.log(`   ✅ Updated: ${updated}`)
  console.log(`   ⏭️  Skipped (already correct): ${skipped}`)
  console.log(`   ❌ Errors: ${errors}`)
  console.log('\n✅ Done!')
  
} catch (error) {
  console.error('❌ Error:', error)
  process.exit(1)
}




