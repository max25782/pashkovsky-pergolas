#!/usr/bin/env node

/**
 * Batch move images from one S3 category to another
 * 
 * Usage:
 * node scripts/batch-move-s3-images.mjs <source-category> <target-category> [filename-pattern]
 * 
 * Examples:
 * node scripts/batch-move-s3-images.mjs pergulot rails
 * node scripts/batch-move-s3-images.mjs pergulot mestor "mestor.*"
 */

import { createClient } from '@supabase/supabase-js'
import { S3Client, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'
import fs from 'fs'

// Load environment variables
const envLocalPath = '.env.local'
const envPath = '.env'

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath })
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
} else {
  dotenv.config()
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME
const S3_REGION = process.env.AWS_S3_REGION || 'us-east-1'
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID
const AWS_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

if (!S3_BUCKET || !AWS_ACCESS_KEY || !AWS_SECRET_KEY) {
  console.error('❌ Missing AWS S3 credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })

const s3Client = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_KEY,
  },
})

// Get arguments
const sourceCategory = process.argv[2]
const targetCategory = process.argv[3]
const filenamePattern = process.argv[4] || '.*'

if (!sourceCategory || !targetCategory) {
  console.error('Usage: node batch-move-s3-images.mjs <source-category> <target-category> [filename-pattern]')
  console.error('Example: node batch-move-s3-images.mjs pergulot rails')
  process.exit(1)
}

async function listS3Images(prefix, pattern) {
  const images = []
  let continuationToken = undefined
  const regex = new RegExp(pattern, 'i')
  
  do {
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    })
    
    const response = await s3Client.send(command)
    
    if (response.Contents) {
      for (const object of response.Contents) {
        const key = object.Key
        const filename = key.split('/').pop()
        if (key.match(/\.(jpg|jpeg|png|webp|gif)$/i) && regex.test(filename)) {
          images.push(key)
        }
      }
    }
    
    continuationToken = response.NextContinuationToken
  } while (continuationToken)
  
  return images
}

async function moveImageInS3(sourceKey, targetKey) {
  try {
    // Copy object
    const copyCommand = new CopyObjectCommand({
      Bucket: S3_BUCKET,
      CopySource: `${S3_BUCKET}/${sourceKey}`,
      Key: targetKey,
    })
    await s3Client.send(copyCommand)
    
    // Delete source
    const deleteCommand = new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: sourceKey,
    })
    await s3Client.send(deleteCommand)
    
    return true
  } catch (error) {
    console.error(`Failed to move ${sourceKey}:`, error.message)
    return false
  }
}

async function updateDatabaseEntry(oldUrl, newUrl, newCategoryKey, newStoragePath) {
  try {
    const { error } = await supabase
      .from('gallery_images')
      .update({
        url: newUrl,
        category_key: newCategoryKey,
        storage_path: newStoragePath,
      })
      .eq('url', oldUrl)
    
    if (error) {
      throw error
    }
    
    return true
  } catch (error) {
    console.error(`Failed to update database for ${oldUrl}:`, error.message)
    return false
  }
}

async function batchMove() {
  console.log('🚀 Batch moving images in S3')
  console.log(`📦 S3 Bucket: ${S3_BUCKET}`)
  console.log(`🌍 Region: ${S3_REGION}`)
  console.log(`📁 From: images/${sourceCategory}/`)
  console.log(`📁 To: images/${targetCategory}/`)
  console.log(`🔍 Pattern: ${filenamePattern}`)
  console.log('')
  
  // Check if target category exists
  const { data: category } = await supabase
    .from('gallery_categories')
    .select('key')
    .eq('key', targetCategory)
    .single()
  
  if (!category) {
    console.error(`❌ Target category '${targetCategory}' not found in database`)
    process.exit(1)
  }
  
  // List images
  const sourcePrefix = `images/${sourceCategory}/`
  console.log('📋 Listing images...')
  const images = await listS3Images(sourcePrefix, filenamePattern)
  
  if (images.length === 0) {
    console.log(`ℹ️  No images found matching pattern: ${filenamePattern}`)
    return
  }
  
  console.log(`📸 Found ${images.length} images to move`)
  console.log('')
  
  let movedCount = 0
  let errorCount = 0
  
  for (let i = 0; i < images.length; i++) {
    const sourceKey = images[i]
    const filename = sourceKey.split('/').pop()
    const progress = `[${i + 1}/${images.length}]`
    
    const targetKey = `images/${targetCategory}/${filename}`
    const sourceUrl = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${sourceKey}`
    const targetUrl = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${targetKey}`
    
    console.log(`${progress} Moving: ${filename}`)
    
    // Move in S3
    const moved = await moveImageInS3(sourceKey, targetKey)
    if (!moved) {
      console.log(`  ❌ Failed to move in S3`)
      errorCount++
      continue
    }
    
    // Update database
    const updated = await updateDatabaseEntry(sourceUrl, targetUrl, targetCategory, targetKey)
    if (!updated) {
      console.log(`  ⚠️  Moved in S3 but failed to update database`)
      errorCount++
      continue
    }
    
    console.log(`  ✅ Moved: ${sourceCategory} → ${targetCategory}`)
    movedCount++
  }
  
  console.log('')
  console.log('='.repeat(50))
  console.log('📊 Move Summary:')
  console.log(`   ✅ Moved: ${movedCount}`)
  console.log(`   ❌ Errors: ${errorCount}`)
  console.log(`   📈 Total: ${images.length}`)
  console.log('='.repeat(50))
  console.log('')
  console.log('✨ Batch move completed!')
}

batchMove().catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})




