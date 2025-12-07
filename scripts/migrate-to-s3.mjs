#!/usr/bin/env node

/**
 * Migration script to move images from Supabase Storage to AWS S3
 * 
 * Required environment variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - AWS_S3_BUCKET_NAME
 * - AWS_S3_REGION
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'
import fetch from 'node-fetch'
import fs from 'fs'

// Load environment variables - try .env.local first, then .env
const envLocalPath = '.env.local'
const envPath = '.env'

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath })
  console.log('📁 Loaded environment from .env.local')
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
  console.log('📁 Loaded environment from .env')
} else {
  console.warn('⚠️  No .env.local or .env file found, using system environment variables')
  dotenv.config() // Try to load from system env
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

// Initialize clients
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const s3Client = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_KEY,
  },
})

async function downloadImage(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

async function uploadToS3(buffer, key, mimeType) {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType || 'image/webp',
    // Removed ACL - use Bucket Policy for public access instead
  })
  
  await s3Client.send(command)
  
  // Return public URL
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`
}

async function migrateImages() {
  console.log('🚀 Starting migration from Supabase Storage to S3...')
  console.log(`📦 S3 Bucket: ${S3_BUCKET}`)
  console.log(`🌍 Region: ${S3_REGION}`)
  console.log('')
  
  // Get all images from database
  const { data: images, error } = await supabase
    .from('gallery_images')
    .select('*')
    .order('created_at', { ascending: true })
  
  if (error) {
    console.error('❌ Error fetching images:', error)
    process.exit(1)
  }
  
  if (!images || images.length === 0) {
    console.log('ℹ️  No images found in database')
    return
  }
  
  console.log(`📸 Found ${images.length} images to migrate`)
  console.log('')
  
  let successCount = 0
  let errorCount = 0
  const errors = []
  
  for (let i = 0; i < images.length; i++) {
    const image = images[i]
    const progress = `[${i + 1}/${images.length}]`
    
    try {
      console.log(`${progress} Migrating: ${image.filename}`)
      
      // Download image from Supabase
      const buffer = await downloadImage(image.url)
      
      // Upload to S3 (keep same structure)
      const s3Key = `${image.category_key}/${image.filename}`
      const s3Url = await uploadToS3(buffer, s3Key, image.mime_type)
      
      // Update database with new URL
      const { error: updateError } = await supabase
        .from('gallery_images')
        .update({
          url: s3Url,
          storage_path: s3Key,
        })
        .eq('id', image.id)
      
      if (updateError) {
        throw new Error(`Database update failed: ${updateError.message}`)
      }
      
      console.log(`✅ ${progress} Success: ${image.filename}`)
      successCount++
      
    } catch (error) {
      console.error(`❌ ${progress} Failed: ${image.filename}`)
      console.error(`   Error: ${error.message}`)
      errorCount++
      errors.push({ filename: image.filename, error: error.message })
    }
  }
  
  console.log('')
  console.log('=' .repeat(50))
  console.log('📊 Migration Summary:')
  console.log(`   ✅ Success: ${successCount}`)
  console.log(`   ❌ Failed: ${errorCount}`)
  console.log(`   📈 Total: ${images.length}`)
  console.log('=' .repeat(50))
  
  if (errors.length > 0) {
    console.log('')
    console.log('❌ Errors:')
    errors.forEach(({ filename, error }) => {
      console.log(`   - ${filename}: ${error}`)
    })
  }
}

// Run migration
migrateImages()
  .then(() => {
    console.log('')
    console.log('✨ Migration completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('')
    console.error('💥 Migration failed:', error)
    process.exit(1)
  })

