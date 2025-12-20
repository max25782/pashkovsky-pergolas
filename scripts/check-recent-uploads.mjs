#!/usr/bin/env node
/**
 * Check recent uploads in S3 and database
 */

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME
const S3_REGION = process.env.AWS_S3_REGION || 'us-east-1'
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID
const AWS_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!S3_BUCKET || !AWS_ACCESS_KEY || !AWS_SECRET_KEY) {
  console.error('❌ Missing S3 configuration')
  process.exit(1)
}

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing Supabase configuration')
  process.exit(1)
}

const s3Client = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_KEY,
  },
})

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

console.log('🔍 Checking recent uploads...\n')

// Check S3 for recent uploads (last 24 hours)
console.log('📦 S3 Recent Uploads (last 24 hours):')
try {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  
  // List all objects in images/ folder
  const listCommand = new ListObjectsV2Command({
    Bucket: S3_BUCKET,
    Prefix: 'images/',
    MaxKeys: 1000,
  })
  
  const result = await s3Client.send(listCommand)
  
  if (result.Contents && result.Contents.length > 0) {
    const recentFiles = result.Contents
      .filter(obj => obj.LastModified && obj.LastModified > oneDayAgo)
      .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0))
    
    if (recentFiles.length > 0) {
      console.log(`✅ Found ${recentFiles.length} files uploaded in last 24 hours:\n`)
      recentFiles.slice(0, 20).forEach((obj, i) => {
        const date = obj.LastModified?.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })
        console.log(`   ${i + 1}. ${obj.Key}`)
        console.log(`      Size: ${obj.Size} bytes, Uploaded: ${date}`)
      })
      if (recentFiles.length > 20) {
        console.log(`   ... and ${recentFiles.length - 20} more`)
      }
    } else {
      console.log('⚠️  No files uploaded in last 24 hours')
    }
    
    console.log(`\n📊 Total files in images/ folder: ${result.Contents.length}`)
  } else {
    console.log('⚠️  No files found in images/ folder')
  }
} catch (error) {
  console.error('❌ Error listing S3 objects:', error.message)
}

console.log('\n' + '='.repeat(80) + '\n')

// Check database for recent uploads
console.log('🗄️  Database Recent Uploads (last 24 hours):')
try {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  
  const { data: images, error } = await supabase
    .from('gallery_images')
    .select('*')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('❌ Database error:', error.message)
  } else if (images && images.length > 0) {
    console.log(`✅ Found ${images.length} records in database:\n`)
    images.slice(0, 20).forEach((img, i) => {
      const date = new Date(img.created_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })
      console.log(`   ${i + 1}. ${img.filename}`)
      console.log(`      Category: ${img.category_key}`)
      console.log(`      URL: ${img.url}`)
      console.log(`      Created: ${date}`)
    })
    if (images.length > 20) {
      console.log(`   ... and ${images.length - 20} more`)
    }
  } else {
    console.log('⚠️  No records found in database from last 24 hours')
  }
} catch (error) {
  console.error('❌ Error querying database:', error.message)
}

console.log('\n' + '='.repeat(80) + '\n')
console.log('💡 Summary:')
console.log('   - If S3 shows files but database is empty: upload succeeded but DB insert failed')
console.log('   - If database shows records but S3 is empty: DB insert succeeded but S3 upload failed')
console.log('   - If both are empty: check browser console for errors during upload')
console.log()




