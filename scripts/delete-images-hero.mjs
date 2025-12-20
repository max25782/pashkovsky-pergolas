/**
 * Simple script to delete public/images and public/hero folders
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PUBLIC_DIR = path.join(__dirname, '..', 'public')

const foldersToDelete = [
  'images',
  'hero'
]

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

async function deleteFolders() {
  console.log('🗑️  Deleting public/images and public/hero...\n')

  let totalDeletedMB = 0
  let deletedFolders = 0
  let deletedFiles = 0

  for (const folder of foldersToDelete) {
    const fullPath = path.join(PUBLIC_DIR, folder)
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⏭️  Skipping (not found): ${folder}`)
      continue
    }

    const sizeMB = getSizeMB(fullPath)
    const fileCount = countFiles(fullPath)
    
    try {
      fs.rmSync(fullPath, { recursive: true, force: true })
      totalDeletedMB += sizeMB
      deletedFolders++
      deletedFiles += fileCount
      console.log(`✅ Deleted: ${folder} (${sizeMB.toFixed(2)} MB, ${fileCount} files)`)
    } catch (error) {
      console.error(`❌ Error deleting ${folder}:`, error.message)
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log(`✅ Deletion complete!`)
  console.log(`   Folders deleted: ${deletedFolders}`)
  console.log(`   Files deleted: ${deletedFiles}`)
  console.log(`   Space freed: ${totalDeletedMB.toFixed(2)} MB`)
  console.log('='.repeat(50))
}

deleteFolders().catch(console.error)



