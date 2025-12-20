#!/usr/bin/env node

/**
 * Setup CORS configuration for S3 bucket
 * 
 * This allows images to be loaded from any origin (localhost, production domain, etc.)
 */

import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from '@aws-sdk/client-s3'
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

const corsConfiguration = {
  CORSRules: [
    {
      AllowedHeaders: ['*'],
      AllowedMethods: ['GET', 'HEAD'],
      AllowedOrigins: ['*'], // Allow all origins (you can restrict this to specific domains in production)
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 3000,
    },
  ],
}

async function setupCORS() {
  console.log('🚀 Setting up CORS for S3 bucket...')
  console.log(`📦 S3 Bucket: ${S3_BUCKET}`)
  console.log(`🌍 Region: ${S3_REGION}`)
  console.log('')
  
  try {
    // Try to get existing CORS configuration
    console.log('📋 Checking existing CORS configuration...')
    try {
      const getCommand = new GetBucketCorsCommand({
        Bucket: S3_BUCKET,
      })
      const existingCors = await s3Client.send(getCommand)
      console.log('Current CORS configuration:')
      console.log(JSON.stringify(existingCors.CORSRules, null, 2))
      console.log('')
    } catch (error) {
      if (error.name === 'NoSuchCORSConfiguration') {
        console.log('ℹ️  No existing CORS configuration found')
      } else {
        console.warn('⚠️  Could not get existing CORS:', error.message)
      }
      console.log('')
    }
    
    // Set new CORS configuration
    console.log('⚙️  Applying new CORS configuration...')
    const putCommand = new PutBucketCorsCommand({
      Bucket: S3_BUCKET,
      CORSConfiguration: corsConfiguration,
    })
    
    await s3Client.send(putCommand)
    
    console.log('✅ CORS configuration updated successfully!')
    console.log('')
    console.log('New CORS rules:')
    console.log('  - Allowed Origins: * (all origins)')
    console.log('  - Allowed Methods: GET, HEAD')
    console.log('  - Allowed Headers: *')
    console.log('  - Max Age: 3000 seconds')
    console.log('')
    console.log('🎉 Your S3 images can now be loaded from any domain!')
    console.log('')
    console.log('⚠️  Note: For production, consider restricting AllowedOrigins to your specific domains:')
    console.log('   - https://pashkovsky-group.com')
    console.log('   - https://crm.pashkovsky-group.com')
    
  } catch (error) {
    console.error('❌ Failed to setup CORS:', error)
    console.error('')
    console.error('Make sure your AWS credentials have the following permissions:')
    console.error('  - s3:PutBucketCors')
    console.error('  - s3:GetBucketCors')
    process.exit(1)
  }
}

setupCORS().catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})



