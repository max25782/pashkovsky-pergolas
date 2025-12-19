#!/usr/bin/env node

/**
 * Fix CORS headers for existing S3 objects by updating their metadata
 * 
 * When you set CORS rules on an S3 bucket, they only apply to new requests.
 * Existing objects need to have their metadata updated to trigger the new CORS rules.
 * 
 * This script copies each object over itself (copy in place) which forces S3
 * to apply the new CORS rules.
 */

import { S3Client, ListObjectsV2Command, CopyObjectCommand } from '@aws-sdk/client-s3'
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

const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME
const S3_REGION = process.env.AWS_S3_REGION || 'us-east-1'
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID
const AWS_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY

if (!S3_BUCKET || !AWS_ACCESS_KEY || !AWS_SECRET_KEY) {
  console.error('❌ Missing AWS S3 credentials')
  process.exit(1)
}

const s3Client = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_KEY,
  },
})

async function listAllObjects(prefix = 'images/') {
  const objects = []
  let continuationToken = undefined
  
  console.log(`📋 Listing all objects with prefix: ${prefix}`)
  
  do {
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    })
    
    const response = await s3Client.send(command)
    
    if (response.Contents) {
      objects.push(...response.Contents)
    }
    
    continuationToken = response.NextContinuationToken
  } while (continuationToken)
  
  return objects
}

async function updateObjectMetadata(key) {
  try {
    // Copy object to itself to refresh metadata and apply CORS
    const copyCommand = new CopyObjectCommand({
      Bucket: S3_BUCKET,
      CopySource: `${S3_BUCKET}/${key}`,
      Key: key,
      MetadataDirective: 'REPLACE', // Force metadata update
      // You can add custom metadata here if needed
      // Metadata: {
      //   'updated': new Date().toISOString()
      // }
    })
    
    await s3Client.send(copyCommand)
    return true
  } catch (error) {
    console.error(`Failed to update ${key}:`, error.message)
    return false
  }
}

async function fixCORSHeaders() {
  console.log('🚀 Fixing CORS headers for existing S3 objects...')
  console.log(`📦 S3 Bucket: ${S3_BUCKET}`)
  console.log(`🌍 Region: ${S3_REGION}`)
  console.log('')
  
  // List all objects
  const objects = await listAllObjects('images/')
  
  if (objects.length === 0) {
    console.log('ℹ️  No objects found')
    return
  }
  
  console.log(`📸 Found ${objects.length} objects to update`)
  console.log('')
  console.log('⏳ This may take a while...')
  console.log('')
  
  let successCount = 0
  let errorCount = 0
  
  for (let i = 0; i < objects.length; i++) {
    const object = objects[i]
    const progress = `[${i + 1}/${objects.length}]`
    
    const success = await updateObjectMetadata(object.Key)
    
    if (success) {
      console.log(`✅ ${progress} Updated: ${object.Key}`)
      successCount++
    } else {
      console.log(`❌ ${progress} Failed: ${object.Key}`)
      errorCount++
    }
    
    // Add small delay to avoid rate limiting
    if (i % 50 === 0 && i > 0) {
      console.log(`⏸️  Processed ${i} objects, pausing briefly...`)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  console.log('')
  console.log('='.repeat(50))
  console.log('📊 Update Summary:')
  console.log(`   ✅ Success: ${successCount}`)
  console.log(`   ❌ Failed: ${errorCount}`)
  console.log(`   📈 Total: ${objects.length}`)
  console.log('='.repeat(50))
  console.log('')
  console.log('✨ CORS metadata update completed!')
  console.log('')
  console.log('🎉 All images should now work with CORS!')
  console.log('   Clear your browser cache (Ctrl+Shift+R) and test.')
}

fixCORSHeaders().catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})

