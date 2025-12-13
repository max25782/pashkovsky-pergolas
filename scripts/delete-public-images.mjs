/**
 * Script to safely delete images from public/images/ after S3 migration
 * Keeps only critical files needed for PDF generation and site functionality
 */

import fs from 'fs'
import path from 'path'

const PUBLIC_DIR = path.join(process.cwd(), 'public')

// Files/folders to KEEP (critical for PDF generation and site)
const KEEP_PATTERNS = [
  'fonts/',           // Hebrew fonts for PDF
  'logo.png',         // Logo for PDF
  'logo-transparent.png', // Logo for PDF (preferred)
  'logo-preview.png', // Logo preview
  'favicon.svg',      // Site favicon
  'data/',            // JSON data files
  'video/',           // Video files (if still used)
]

// Folders to DELETE (migrated to S3)
const DELETE_FOLDERS = [
  'images/dgamim',
  'images/fancy',
  'images/fromShetah',
  'images/mestor',
  'images/pergulot',
  'images/profiles',
  'images/rails',
  'images/services',
  'images/windows',
  'images/logos',     // Partner logos (if migrated to S3)
  'hero',             // Hero videos (migrated to S3)
]

function shouldKeep(filePath) {
  const relativePath = path.relative(PUBLIC_DIR, filePath)
  return KEEP_PATTERNS.some(pattern => relativePath.includes(pattern))
}

function getSizeMB(dirPath) {
  let totalSize = 0
  try {
    const files = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const file of files) {
      const fullPath = path.join(dirPath, file.name)
      if (file.isDirectory()) {
        totalSize += getSizeMB(fullPath)
      } else {
        const stats = fs.statSync(fullPath)
        totalSize += stats.size
      }
    }
  } catch (error) {
    // Ignore errors
  }
  return totalSize / (1024 * 1024)
}

async function deletePublicImages() {
  console.log('🗑️  Starting safe deletion of public/images/...\n')

  // Check if S3 is configured
  const hasS3 = !!(process.env.AWS_S3_BUCKET_NAME || process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME)
  if (!hasS3) {
    console.error('❌ S3 is not configured! Set AWS_S3_BUCKET_NAME or NEXT_PUBLIC_AWS_S3_BUCKET_NAME')
    console.error('   Aborting deletion to prevent data loss.')
    process.exit(1)
  }

  console.log('✅ S3 is configured, proceeding with deletion...\n')

  let totalDeletedMB = 0
  let deletedFolders = 0
  let deletedFiles = 0

  // Delete each folder
  for (const folder of DELETE_FOLDERS) {
    const fullPath = path.join(PUBLIC_DIR, folder)
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⏭️  Skipping (not found): ${folder}`)
      continue
    }

    const sizeMB = getSizeMB(fullPath)
    
    try {
      fs.rmSync(fullPath, { recursive: true, force: true })
      totalDeletedMB += sizeMB
      deletedFolders++
      deletedFiles += countFiles(fullPath)
      console.log(`✅ Deleted: ${folder} (${sizeMB.toFixed(2)} MB)`)
    } catch (error) {
      console.error(`❌ Error deleting ${folder}:`, error.message)
    }
  }

  // Check if images folder is now empty
  const imagesDir = path.join(PUBLIC_DIR, 'images')
  if (fs.existsSync(imagesDir)) {
    const remainingFiles = fs.readdirSync(imagesDir)
    if (remainingFiles.length === 0) {
      try {
        fs.rmdirSync(imagesDir)
        console.log(`\n✅ Deleted empty images/ folder`)
      } catch (error) {
        console.warn(`⚠️  Could not delete empty images/ folder:`, error.message)
      }
    } else {
      console.log(`\n⚠️  images/ folder still contains: ${remainingFiles.join(', ')}`)
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log(`✅ Deletion complete!`)
  console.log(`   Folders deleted: ${deletedFolders}`)
  console.log(`   Files deleted: ${deletedFiles}`)
  console.log(`   Space freed: ${totalDeletedMB.toFixed(2)} MB`)
  console.log('\n📋 Kept files:')
  KEEP_PATTERNS.forEach(pattern => console.log(`   - ${pattern}`))
  console.log('='.repeat(50))
}

function countFiles(dirPath) {
  let count = 0
  try {
    const files = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const file of files) {
      const fullPath = path.join(dirPath, file.name)
      if (file.isDirectory()) {
        count += countFiles(fullPath)
      } else {
        count++
      }
    }
  } catch {
    // Ignore errors
  }
  return count
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  deletePublicImages().catch(console.error)
}

export { deletePublicImages }


