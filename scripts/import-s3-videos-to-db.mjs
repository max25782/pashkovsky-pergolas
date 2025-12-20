#!/usr/bin/env node

/**
 * Import video files from S3 bucket to gallery_images database table
 * 
 * This script specifically looks for video files (.mp4, .webm, .mov)
 * and creates database entries for them.
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

const prefix = process.argv[2] || 'images/'

async function listS3Videos(prefix) {
  const videos = []
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
        // Only process video files
        if (key.match(/\.(mp4|webm|mov|avi)$/i)) {
          videos.push({
            key,
            size: object.Size,
            lastModified: object.LastModified,
          })
        }
      }
    }
    
    continuationToken = response.NextContinuationToken
  } while (continuationToken)
  
  return videos
}

async function getVideoMetadata(key) {
  try {
    const command = new HeadObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    })
    
    const response = await s3Client.send(command)
    return {
      size: response.ContentLength,
      contentType: response.ContentType || 'video/mp4',
      lastModified: response.LastModified,
    }
  } catch (error) {
    console.warn(`⚠️  Could not get metadata for ${key}:`, error.message)
    return null
  }
}

function extractCategoryFromPath(key) {
  const match = key.match(/images\/([^\/]+)\//)
  if (match) {
    return match[1]
  }
  return null
}

async function importVideos() {
  console.log('🚀 Starting import of videos from S3 to database...')
  console.log(`📦 S3 Bucket: ${S3_BUCKET}`)
  console.log(`🌍 Region: ${S3_REGION}`)
  console.log(`📁 Prefix: ${prefix}`)
  console.log('')
  
  console.log('📋 Listing videos from S3...')
  const s3Videos = await listS3Videos(prefix)
  
  if (s3Videos.length === 0) {
    console.log('ℹ️  No videos found in S3 with prefix:', prefix)
    return
  }
  
  console.log(`🎬 Found ${s3Videos.length} videos in S3`)
  console.log('')
  
  // Get existing videos from database
  const { data: existingVideos } = await supabase
    .from('gallery_images')
    .select('url, storage_path')
  
  const existingUrls = new Set(existingVideos?.map(v => v.url) || [])
  const existingPaths = new Set(existingVideos?.map(v => v.storage_path) || [])
  
  let importedCount = 0
  let skippedCount = 0
  let errorCount = 0
  const errors = []
  
  for (let i = 0; i < s3Videos.length; i++) {
    const s3Video = s3Videos[i]
    const progress = `[${i + 1}/${s3Videos.length}]`
    
    try {
      const s3Url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${s3Video.key}`
      
      // Skip if already exists
      if (existingUrls.has(s3Url) || existingPaths.has(s3Video.key)) {
        console.log(`⏭️  ${progress} Skipped (already exists): ${s3Video.key}`)
        skippedCount++
        continue
      }
      
      // Extract category from path
      const categoryKey = extractCategoryFromPath(s3Video.key)
      if (!categoryKey) {
        console.warn(`⚠️  ${progress} Could not extract category from: ${s3Video.key}`)
        errorCount++
        errors.push({ key: s3Video.key, error: 'Could not extract category' })
        continue
      }
      
      // Check if category exists
      const { data: category } = await supabase
        .from('gallery_categories')
        .select('key')
        .eq('key', categoryKey)
        .single()
      
      if (!category) {
        console.warn(`⚠️  ${progress} Category '${categoryKey}' not found for: ${s3Video.key}`)
        errorCount++
        errors.push({ key: s3Video.key, error: `Category '${categoryKey}' not found` })
        continue
      }
      
      // Get video metadata
      const metadata = await getVideoMetadata(s3Video.key)
      if (!metadata) {
        console.warn(`⚠️  ${progress} Could not get metadata for: ${s3Video.key}`)
        errorCount++
        errors.push({ key: s3Video.key, error: 'Could not get metadata' })
        continue
      }
      
      // Extract filename from key
      const filename = s3Video.key.split('/').pop()
      
      // Insert into database
      const { data: videoData, error: dbError } = await supabase
        .from('gallery_images')
        .insert({
          category_key: categoryKey,
          filename,
          url: s3Url,
          storage_path: s3Video.key,
          size: metadata.size || s3Video.size,
          mime_type: metadata.contentType || 'video/mp4',
          width: null,
          height: null,
        })
        .select()
        .single()
      
      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`)
      }
      
      console.log(`✅ ${progress} Imported: ${s3Video.key} -> category: ${categoryKey}`)
      importedCount++
      
    } catch (error) {
      console.error(`❌ ${progress} Failed: ${s3Video.key}`)
      console.error(`   Error: ${error.message}`)
      errorCount++
      errors.push({ key: s3Video.key, error: error.message })
    }
  }
  
  console.log('')
  console.log('='.repeat(50))
  console.log('📊 Import Summary:')
  console.log(`   ✅ Imported: ${importedCount}`)
  console.log(`   ⏭️  Skipped (already exists): ${skippedCount}`)
  console.log(`   ❌ Failed: ${errorCount}`)
  console.log(`   📈 Total: ${s3Videos.length}`)
  console.log('='.repeat(50))
  
  if (errors.length > 0) {
    console.log('')
    console.log('❌ Errors:')
    errors.forEach(({ key, error }) => {
      console.log(`   - ${key}: ${error}`)
    })
  }
  
  console.log('')
  console.log('✨ Video import completed!')
}

importVideos().catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})



