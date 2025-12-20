#!/usr/bin/env node
/**
 * Fix S3 CORS policy to allow access from all origins
 * This sets the CORS configuration on the bucket level
 */

import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from '@aws-sdk/client-s3'
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

console.log('🔧 Updating S3 CORS policy...\n')
console.log(`Bucket: ${S3_BUCKET}`)
console.log(`Region: ${S3_REGION}\n`)

// CORS configuration that allows ALL origins
const corsConfiguration = {
  CORSRules: [
    {
      AllowedOrigins: ['*'], // Allow ALL origins
      AllowedMethods: ['GET', 'HEAD'],
      AllowedHeaders: ['*'],
      ExposeHeaders: [
        'ETag',
        'Content-Length',
        'Content-Type',
        'Last-Modified',
        'x-amz-request-id'
      ],
      MaxAgeSeconds: 3600, // Cache preflight for 1 hour
    },
  ],
}

try {
  // Get current CORS configuration
  console.log('📋 Current CORS configuration:')
  try {
    const getCurrentCors = new GetBucketCorsCommand({
      Bucket: S3_BUCKET,
    })
    const currentCors = await s3Client.send(getCurrentCors)
    console.log(JSON.stringify(currentCors.CORSRules, null, 2))
  } catch (error) {
    if (error.name === 'NoSuchCORSConfiguration') {
      console.log('   (No CORS configuration exists)')
    } else {
      console.error('   Error getting CORS:', error.message)
    }
  }
  console.log()

  // Set new CORS configuration
  console.log('🔄 Setting new CORS configuration...')
  const command = new PutBucketCorsCommand({
    Bucket: S3_BUCKET,
    CORSConfiguration: corsConfiguration,
  })

  await s3Client.send(command)
  
  console.log('✅ CORS policy updated successfully!\n')
  
  console.log('📋 New CORS configuration:')
  console.log(JSON.stringify(corsConfiguration.CORSRules, null, 2))
  console.log()
  
  console.log('🎯 What this allows:')
  console.log('   ✅ Access from ANY origin (*)')
  console.log('   ✅ GET and HEAD requests')
  console.log('   ✅ All headers')
  console.log('   ✅ Preflight cache: 1 hour')
  console.log()
  
  console.log('⚠️  Important Notes:')
  console.log('   - CORS changes take effect immediately')
  console.log('   - Browser may cache old responses (clear cache)')
  console.log('   - Test in incognito mode for fresh results')
  console.log()
  
  console.log('✅ Done! Your images should now load without CORS errors.')
  
} catch (error) {
  console.error('❌ Error updating CORS policy:', error)
  console.error('Details:', error.message)
  process.exit(1)
}



