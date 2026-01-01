#!/usr/bin/env node

/**
 * Migration script to move ALL images from public/images to AWS S3
 * Preserves folder structure
 * 
 * Required environment variables:
 * - AWS_S3_BUCKET_NAME
 * - AWS_S3_REGION
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables - try .env.local first, then .env
const envLocalPath = path.join(__dirname, '..', '.env.local')
const envPath = path.join(__dirname, '..', '.env')

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath })
  console.log('📁 Loaded environment from .env.local')
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
  console.log('📁 Loaded environment from .env')
} else {
  console.warn('⚠️  No .env.local or .env file found')
}

const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME
const S3_REGION = process.env.AWS_S3_REGION || 'us-east-1'
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID
const AWS_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY

if (!S3_BUCKET || !AWS_ACCESS_KEY || !AWS_SECRET_KEY) {
  console.error('❌ Missing AWS S3 credentials')
  console.error('Required variables:')
  console.error(`  AWS_S3_BUCKET_NAME: ${S3_BUCKET ? '✅' : '❌'}`)
  console.error(`  AWS_S3_REGION: ${S3_REGION ? '✅' : '❌'}`)
  console.error(`  AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY ? '✅' : '❌'}`)
  console.error(`  AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_KEY ? '✅' : '❌'}`)
  process.exit(1)
}

// Initialize S3 client
const s3Client = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_KEY,
  },
})

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif']
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov']

function isMediaFile(filename) {
  const ext = path.extname(filename).toLowerCase()
  return IMAGE_EXTENSIONS.includes(ext) || VIDEO_EXTENSIONS.includes(ext)
}

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase()
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.avif': 'image/avif',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

async function uploadToS3(buffer, key, mimeType) {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    // No ACL - using Bucket Policy for public access
  })
  
  await s3Client.send(command)
  
  // Return public URL
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`
}

function getAllFiles(dirPath, arrayOfFiles = [], baseDir = dirPath) {
  const files = fs.readdirSync(dirPath)
  
  files.forEach((file) => {
    const filePath = path.join(dirPath, file)
    
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles, baseDir)
    } else {
      if (isMediaFile(file)) {
        const relativePath = path.relative(baseDir, filePath)
        arrayOfFiles.push({
          fullPath: filePath,
          relativePath: relativePath.replace(/\\/g, '/'), // Convert Windows paths to Unix
          filename: file,
        })
      }
    }
  })
  
  return arrayOfFiles
}

async function migratePublicImages() {
  console.log('🚀 Starting migration of public/images to S3...')
  console.log(`📦 S3 Bucket: ${S3_BUCKET}`)
  console.log(`🌍 Region: ${S3_REGION}`)
  console.log('')
  
  const publicImagesDir = path.join(__dirname, '..', 'public', 'images')
  
  if (!fs.existsSync(publicImagesDir)) {
    console.error('❌ public/images directory not found')
    process.exit(1)
  }
  
  // Get all media files recursively
  const files = getAllFiles(publicImagesDir)
  
  if (files.length === 0) {
    console.log('ℹ️  No media files found in public/images')
    return
  }
  
  console.log(`📸 Found ${files.length} media files to migrate`)
  console.log('')
  
  let successCount = 0
  let errorCount = 0
  const errors = []
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const progress = `[${i + 1}/${files.length}]`
    
    try {
      // Read file
      const buffer = fs.readFileSync(file.fullPath)
      const mimeType = getMimeType(file.filename)
      
      // Upload to S3 with same structure (images/category/file.webp)
      const s3Key = `images/${file.relativePath}`
      
      console.log(`${progress} Uploading: ${file.relativePath}`)
      
      const s3Url = await uploadToS3(buffer, s3Key, mimeType)
      
      console.log(`✅ ${progress} Success: ${file.relativePath}`)
      successCount++
      
    } catch (error) {
      console.error(`❌ ${progress} Failed: ${file.relativePath}`)
      console.error(`   Error: ${error.message}`)
      errorCount++
      errors.push({ file: file.relativePath, error: error.message })
    }
  }
  
  console.log('')
  console.log('='.repeat(50))
  console.log('📊 Migration Summary:')
  console.log(`   ✅ Success: ${successCount}`)
  console.log(`   ❌ Failed: ${errorCount}`)
  console.log(`   📈 Total: ${files.length}`)
  console.log('='.repeat(50))
  
  if (errors.length > 0) {
    console.log('')
    console.log('❌ Errors:')
    errors.forEach(({ file, error }) => {
      console.log(`   - ${file}: ${error}`)
    })
  }
  
  console.log('')
  console.log('📝 Next steps:')
  console.log('   1. Update next.config.js to use S3 domain for images')
  console.log('   2. Test the website to ensure images load')
  console.log('   3. Optionally delete local images from public/images')
}

// Run migration
migratePublicImages()
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






