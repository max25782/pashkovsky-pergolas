#!/usr/bin/env node
/**
 * Test S3 upload functionality
 * Usage: node scripts/test-s3-upload.mjs
 */

import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import 'dotenv/config'

const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME
const S3_REGION = process.env.AWS_S3_REGION || 'us-east-1'
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID
const AWS_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY

console.log('🔍 Checking S3 configuration...\n')
console.log('S3_BUCKET:', S3_BUCKET)
console.log('S3_REGION:', S3_REGION)
console.log('AWS_ACCESS_KEY:', AWS_ACCESS_KEY ? `${AWS_ACCESS_KEY.slice(0, 8)}...` : 'NOT SET')
console.log('AWS_SECRET_KEY:', AWS_SECRET_KEY ? '***SET***' : 'NOT SET')
console.log()

if (!S3_BUCKET || !AWS_ACCESS_KEY || !AWS_SECRET_KEY) {
  console.error('❌ Missing S3 configuration in .env file')
  console.error('Required variables:')
  console.error('  - AWS_S3_BUCKET_NAME')
  console.error('  - AWS_S3_REGION')
  console.error('  - AWS_ACCESS_KEY_ID')
  console.error('  - AWS_SECRET_ACCESS_KEY')
  process.exit(1)
}

const s3Client = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_KEY,
  },
})

console.log('✅ S3 client initialized\n')

// Test 1: List objects in bucket
console.log('📋 Test 1: Listing objects in bucket...')
try {
  const listCommand = new ListObjectsV2Command({
    Bucket: S3_BUCKET,
    MaxKeys: 5,
  })
  const listResult = await s3Client.send(listCommand)
  console.log(`✅ Successfully listed objects. Found ${listResult.KeyCount || 0} objects (showing max 5):`)
  if (listResult.Contents && listResult.Contents.length > 0) {
    listResult.Contents.forEach((obj, i) => {
      console.log(`   ${i + 1}. ${obj.Key} (${obj.Size} bytes)`)
    })
  } else {
    console.log('   (Bucket is empty or no objects found)')
  }
  console.log()
} catch (error) {
  console.error('❌ Failed to list objects:', error.message)
  console.error('   This might indicate permission issues or incorrect bucket name.')
  console.log()
}

// Test 2: Upload a test file
console.log('📤 Test 2: Uploading test file...')
try {
  const testContent = Buffer.from('Test upload from pashkovsky-pergolas CRM')
  const testKey = `test/upload-test-${Date.now()}.txt`
  
  const uploadCommand = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: testKey,
    Body: testContent,
    ContentType: 'text/plain',
  })
  
  await s3Client.send(uploadCommand)
  const publicUrl = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${testKey}`
  
  console.log(`✅ Successfully uploaded test file!`)
  console.log(`   Key: ${testKey}`)
  console.log(`   URL: ${publicUrl}`)
  console.log()
  console.log('🎉 S3 upload is working correctly!')
  console.log()
  console.log('⚠️  Note: If you cannot access the file via browser, check:')
  console.log('   1. S3 Bucket Policy allows public read access')
  console.log('   2. S3 Bucket "Block Public Access" settings')
  console.log('   3. CORS configuration (for browser access)')
  console.log()
  console.log('To test public access, try opening this URL in your browser:')
  console.log(`   ${publicUrl}`)
  
} catch (error) {
  console.error('❌ Failed to upload test file:', error.message)
  console.error('   Error details:', error)
  console.log()
  console.log('Common causes:')
  console.log('  - Invalid AWS credentials')
  console.log('  - Insufficient IAM permissions (need s3:PutObject)')
  console.log('  - Bucket does not exist')
  console.log('  - Bucket is in a different region')
  process.exit(1)
}

