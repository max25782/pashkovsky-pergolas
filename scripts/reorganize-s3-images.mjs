#!/usr/bin/env node

/**
 * Reorganize S3 images from one category to multiple categories
 * 
 * This script allows you to:
 * 1. Move or copy images from one S3 folder to another
 * 2. Update database entries with new category_key and storage_path
 * 3. Organize images by category (rails, mestor, windows, etc.)
 * 
 * Usage:
 * node scripts/reorganize-s3-images.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { S3Client, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'
import fs from 'fs'
import readline from 'readline'

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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

async function listS3Images(prefix) {
  const images = []
  let continuationToken = undefined
  
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
        if (key.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
          images.push(key)
        }
      }
    }
    
    continuationToken = response.NextContinuationToken
  } while (continuationToken)
  
  return images
}

async function copyImageInS3(sourceKey, targetKey) {
  try {
    // Copy object
    const copyCommand = new CopyObjectCommand({
      Bucket: S3_BUCKET,
      CopySource: `${S3_BUCKET}/${sourceKey}`,
      Key: targetKey,
    })
    await s3Client.send(copyCommand)
    
    return true
  } catch (error) {
    console.error(`Failed to copy ${sourceKey} to ${targetKey}:`, error.message)
    return false
  }
}

async function moveImageInS3(sourceKey, targetKey) {
  try {
    // Copy object
    await copyImageInS3(sourceKey, targetKey)
    
    // Delete source
    const deleteCommand = new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: sourceKey,
    })
    await s3Client.send(deleteCommand)
    
    return true
  } catch (error) {
    console.error(`Failed to move ${sourceKey} to ${targetKey}:`, error.message)
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

async function reorganizeImages() {
  console.log('🚀 S3 Image Reorganization Tool')
  console.log(`📦 S3 Bucket: ${S3_BUCKET}`)
  console.log(`🌍 Region: ${S3_REGION}`)
  console.log('')
  
  // Get source category
  const sourceCategory = await question('Enter source category (e.g., pergulot): ')
  if (!sourceCategory.trim()) {
    console.error('❌ Source category is required')
    rl.close()
    return
  }
  
  // List images in source category
  const sourcePrefix = `images/${sourceCategory}/`
  console.log(`\n📋 Listing images in ${sourcePrefix}...`)
  const images = await listS3Images(sourcePrefix)
  
  if (images.length === 0) {
    console.log(`ℹ️  No images found in ${sourcePrefix}`)
    rl.close()
    return
  }
  
  console.log(`📸 Found ${images.length} images`)
  console.log('')
  
  // Show available categories
  const { data: categories } = await supabase
    .from('gallery_categories')
    .select('key, name_he, name_ru')
  
  console.log('Available categories:')
  categories?.forEach(cat => {
    console.log(`  - ${cat.key} (${cat.name_he || cat.name_ru || cat.key})`)
  })
  console.log('')
  
  // Interactive reorganization
  console.log('For each image, enter target category (or press Enter to skip)')
  console.log('Commands: q=quit, s=skip all remaining, l=list categories')
  console.log('')
  
  let movedCount = 0
  let skippedCount = 0
  let errorCount = 0
  
  for (let i = 0; i < images.length; i++) {
    const sourceKey = images[i]
    const filename = sourceKey.split('/').pop()
    const progress = `[${i + 1}/${images.length}]`
    
    console.log(`${progress} ${sourceKey}`)
    const answer = await question(`  Target category (current: ${sourceCategory}): `)
    
    const command = answer.trim().toLowerCase()
    
    if (command === 'q') {
      console.log('Quitting...')
      break
    }
    
    if (command === 's') {
      console.log(`Skipping remaining ${images.length - i} images`)
      skippedCount += images.length - i
      break
    }
    
    if (command === 'l') {
      console.log('\nAvailable categories:')
      categories?.forEach(cat => {
        console.log(`  - ${cat.key} (${cat.name_he || cat.name_ru || cat.key})`)
      })
      i-- // Retry this image
      continue
    }
    
    if (!command || command === sourceCategory) {
      console.log('  ⏭️  Skipped (same category)')
      skippedCount++
      continue
    }
    
    // Check if target category exists
    const targetCategory = categories?.find(c => c.key === command)
    if (!targetCategory) {
      console.log(`  ❌ Category '${command}' not found. Skipping.`)
      skippedCount++
      continue
    }
    
    // Move image
    const targetKey = `images/${command}/${filename}`
    const sourceUrl = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${sourceKey}`
    const targetUrl = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${targetKey}`
    
    console.log(`  📦 Moving to ${targetKey}...`)
    
    const moved = await moveImageInS3(sourceKey, targetKey)
    if (!moved) {
      console.log(`  ❌ Failed to move in S3`)
      errorCount++
      continue
    }
    
    // Update database
    const updated = await updateDatabaseEntry(sourceUrl, targetUrl, command, targetKey)
    if (!updated) {
      console.log(`  ⚠️  Moved in S3 but failed to update database`)
      errorCount++
      continue
    }
    
    console.log(`  ✅ Moved: ${sourceCategory} → ${command}`)
    movedCount++
  }
  
  console.log('')
  console.log('='.repeat(50))
  console.log('📊 Reorganization Summary:')
  console.log(`   ✅ Moved: ${movedCount}`)
  console.log(`   ⏭️  Skipped: ${skippedCount}`)
  console.log(`   ❌ Errors: ${errorCount}`)
  console.log(`   📈 Total: ${images.length}`)
  console.log('='.repeat(50))
  
  rl.close()
  console.log('\n✨ Reorganization completed!')
}

reorganizeImages().catch(error => {
  console.error('❌ Fatal error:', error)
  rl.close()
  process.exit(1)
})




