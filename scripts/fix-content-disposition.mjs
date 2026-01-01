#!/usr/bin/env node
/**
 * Fix Content-Disposition for all files in S3
 * Change from 'attachment' to 'inline' so images open in browser
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

console.log('🔧 Fixing Content-Disposition for all files...\n')
console.log(`Bucket: ${S3_BUCKET}`)
console.log(`Region: ${S3_REGION}\n`)

let updated = 0
let skipped = 0
let errors = 0

async function processObjects(prefix) {
  let continuationToken = undefined
  
  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: 1000
    })
    
    const response = await s3Client.send(listCommand)
    
    if (!response.Contents || response.Contents.length === 0) {
      break
    }
    
    console.log(`📦 Processing ${response.Contents.length} objects...`)
    
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
        
        // Check if needs update
        const needsUpdate = 
          head.ContentDisposition !== 'inline' ||
          head.ContentType !== correctContentType ||
          !head.CacheControl
        
        if (!needsUpdate) {
          skipped++
          continue
        }
        
        // Update via copy-to-self with correct metadata
        const copyCommand = new CopyObjectCommand({
          Bucket: S3_BUCKET,
          Key: obj.Key,
          CopySource: `${S3_BUCKET}/${encodeURIComponent(obj.Key)}`,
          ContentType: correctContentType,
          ContentDisposition: 'inline', // ВАЖНО: inline вместо attachment
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
    
    continuationToken = response.NextContinuationToken
    
  } while (continuationToken)
}

try {
  // Process all files in images/ folder
  await processObjects('images/')
  
  // Also process hero/ and test/ folders if they exist
  await processObjects('hero/')
  await processObjects('test/')
  
  console.log('\n📊 Summary:')
  console.log(`   ✅ Updated: ${updated}`)
  console.log(`   ⏭️  Skipped (already correct): ${skipped}`)
  console.log(`   ❌ Errors: ${errors}`)
  console.log('\n✅ Done! Files should now open in browser instead of downloading.')
  
} catch (error) {
  console.error('❌ Error:', error)
  process.exit(1)
}




