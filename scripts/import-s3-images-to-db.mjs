#!/usr/bin/env node

/**
 * Import images from S3 bucket to gallery_images database table
 * 
 * This script:
 * 1. Lists all images from S3 bucket (or specific prefix like images/rails/)
 * 2. Creates database entries in gallery_images table
 * 3. Extracts category_key from S3 path (e.g., images/rails/file.webp -> rails)
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
import { S3Client, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'
import fs from 'fs'

// Load environment variables
const envLocalPath = '.env.local'
const envPath = '.env'

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath })
  console.log('📁 Loaded environment from .env.local')
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
  console.log('📁 Loaded environment from .env')
} else {
  console.warn('⚠️  No .env.local or .env file found')
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

// Get prefix from command line argument (e.g., images/rails/)
const prefix = process.argv[2] || 'images/'

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
        // Only process image files
        const key = object.Key
        if (key.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
          images.push({
            key,
            size: object.Size,
            lastModified: object.LastModified,
          })
        }
      }
    }
    
    continuationToken = response.NextContinuationToken
  } while (continuationToken)
  
  return images
}

async function getImageMetadata(key) {
  try {
    const command = new HeadObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    })
    
    const response = await s3Client.send(command)
    return {
      size: response.ContentLength,
      contentType: response.ContentType || 'image/webp',
      lastModified: response.LastModified,
    }
  } catch (error) {
    console.warn(`⚠️  Could not get metadata for ${key}:`, error.message)
    return null
  }
}

function extractCategoryFromPath(key) {
  // Extract category from path like: images/rails/file.webp -> rails
  // or: images/mestor/image.jpg -> mestor
  const match = key.match(/images\/([^\/]+)\//)
  if (match) {
    return match[1]
  }
  return null
}

async function importImages() {
  console.log('🚀 Starting import of images from S3 to database...')
  console.log(`📦 S3 Bucket: ${S3_BUCKET}`)
  console.log(`🌍 Region: ${S3_REGION}`)
  console.log(`📁 Prefix: ${prefix}`)
  console.log('')
  
  // List all images from S3
  console.log('📋 Listing images from S3...')
  const s3Images = await listS3Images(prefix)
  
  if (s3Images.length === 0) {
    console.log('ℹ️  No images found in S3 with prefix:', prefix)
    return
  }
  
  console.log(`📸 Found ${s3Images.length} images in S3`)
  console.log('')
  
  // Get existing images from database to avoid duplicates
  const { data: existingImages } = await supabase
    .from('gallery_images')
    .select('url, storage_path')
  
  const existingUrls = new Set(existingImages?.map(img => img.url) || [])
  const existingPaths = new Set(existingImages?.map(img => img.storage_path) || [])
  
  let importedCount = 0
  let skippedCount = 0
  let errorCount = 0
  const errors = []
  
  for (let i = 0; i < s3Images.length; i++) {
    const s3Image = s3Images[i]
    const progress = `[${i + 1}/${s3Images.length}]`
    
    try {
      const s3Url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${s3Image.key}`
      
      // Skip if already exists
      if (existingUrls.has(s3Url) || existingPaths.has(s3Image.key)) {
        console.log(`⏭️  ${progress} Skipped (already exists): ${s3Image.key}`)
        skippedCount++
        continue
      }
      
      // Extract category from path
      const categoryKey = extractCategoryFromPath(s3Image.key)
      if (!categoryKey) {
        console.warn(`⚠️  ${progress} Could not extract category from: ${s3Image.key}`)
        errorCount++
        errors.push({ key: s3Image.key, error: 'Could not extract category' })
        continue
      }
      
      // Check if category exists
      const { data: category } = await supabase
        .from('gallery_categories')
        .select('key')
        .eq('key', categoryKey)
        .single()
      
      if (!category) {
        console.warn(`⚠️  ${progress} Category '${categoryKey}' not found for: ${s3Image.key}`)
        errorCount++
        errors.push({ key: s3Image.key, error: `Category '${categoryKey}' not found` })
        continue
      }
      
      // Get image metadata
      const metadata = await getImageMetadata(s3Image.key)
      if (!metadata) {
        console.warn(`⚠️  ${progress} Could not get metadata for: ${s3Image.key}`)
        errorCount++
        errors.push({ key: s3Image.key, error: 'Could not get metadata' })
        continue
      }
      
      // Extract filename from key
      const filename = s3Image.key.split('/').pop()
      
      // Insert into database
      const { data: imageData, error: dbError } = await supabase
        .from('gallery_images')
        .insert({
          category_key: categoryKey,
          filename,
          url: s3Url,
          storage_path: s3Image.key,
          size: metadata.size || s3Image.size,
          mime_type: metadata.contentType || 'image/webp',
          width: null, // Would need to download and process image to get dimensions
          height: null,
        })
        .select()
        .single()
      
      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`)
      }
      
      console.log(`✅ ${progress} Imported: ${s3Image.key} -> category: ${categoryKey}`)
      importedCount++
      
    } catch (error) {
      console.error(`❌ ${progress} Failed: ${s3Image.key}`)
      console.error(`   Error: ${error.message}`)
      errorCount++
      errors.push({ key: s3Image.key, error: error.message })
    }
  }
  
  console.log('')
  console.log('='.repeat(50))
  console.log('📊 Import Summary:')
  console.log(`   ✅ Imported: ${importedCount}`)
  console.log(`   ⏭️  Skipped (already exists): ${skippedCount}`)
  console.log(`   ❌ Failed: ${errorCount}`)
  console.log(`   📈 Total: ${s3Images.length}`)
  console.log('='.repeat(50))
  
  if (errors.length > 0) {
    console.log('')
    console.log('❌ Errors:')
    errors.forEach(({ key, error }) => {
      console.log(`   - ${key}: ${error}`)
    })
  }
  
  console.log('')
  console.log('✨ Import completed!')
}

importImages().catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})




