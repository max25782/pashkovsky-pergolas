/**
 * Script to check if it's safe to delete public/images/
 * Checks:
 * 1. S3 is configured
 * 2. No runtime code reads from public/images directly
 * 3. All components use getImageUrl() helper
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function checkS3Config() {
  const envLocalPath = path.join(__dirname, '..', '.env.local')
  const envPath = path.join(__dirname, '..', '.env')
  
  let envContent = ''
  if (fs.existsSync(envLocalPath)) {
    envContent = fs.readFileSync(envLocalPath, 'utf-8')
  } else if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8')
  }

  const hasS3Bucket = envContent.includes('AWS_S3_BUCKET_NAME') || envContent.includes('NEXT_PUBLIC_AWS_S3_BUCKET_NAME')
  const hasS3Region = envContent.includes('AWS_S3_REGION') || envContent.includes('NEXT_PUBLIC_AWS_S3_REGION')
  
  return { configured: hasS3Bucket && hasS3Region, envContent }
}

function checkRuntimeUsage() {
  const appDir = path.join(__dirname, '..', 'app')
  const componentsDir = path.join(__dirname, '..', 'components')
  
  const problematicPatterns = [
    /fs\.readdirSync.*images/,
    /readFileSync.*images/,
    /public\/images[^/]/,
    /fs\.readdirSync.*hero/,
    /readFileSync.*hero/,
    /public\/hero[^/]/,
  ]

  const issues = []

  function checkFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      problematicPatterns.forEach((pattern, index) => {
        if (pattern.test(content)) {
          issues.push(`${filePath}: Found direct filesystem access to images`)
        }
      })
    } catch (err) {
      // Ignore errors
    }
  }

  function walkDir(dir) {
    if (!fs.existsSync(dir)) return
    
    const files = fs.readdirSync(dir)
    for (const file of files) {
      const filePath = path.join(dir, file)
      const stat = fs.statSync(filePath)
      
      if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('.next')) {
        walkDir(filePath)
      } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.js')) {
        checkFile(filePath)
      }
    }
  }

  walkDir(appDir)
  walkDir(componentsDir)

  return issues
}

function checkImageUsage() {
  const appDir = path.join(__dirname, '..', 'app')
  const componentsDir = path.join(__dirname, '..', 'components')
  
  let usesGetImageUrl = 0
  let usesDirectPath = 0

  function checkFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      if (content.includes('getImageUrl') || content.includes('processImageArray')) {
        usesGetImageUrl++
      }
      if ((content.includes('/images/') || content.includes('/hero/')) && !content.includes('getImageUrl')) {
        usesDirectPath++
      }
    } catch (err) {
      // Ignore errors
    }
  }

  function walkDir(dir) {
    if (!fs.existsSync(dir)) return
    
    const files = fs.readdirSync(dir)
    for (const file of files) {
      const filePath = path.join(dir, file)
      const stat = fs.statSync(filePath)
      
      if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('.next')) {
        walkDir(filePath)
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        checkFile(filePath)
      }
    }
  }

  walkDir(appDir)
  walkDir(componentsDir)

  return { usesGetImageUrl, usesDirectPath }
}

async function main() {
  console.log('🔍 Checking if it\'s safe to delete public/images/...\n')

  // Check 1: S3 Configuration
  console.log('1️⃣ Checking S3 configuration...')
  const s3Check = checkS3Config()
  if (s3Check.configured) {
    console.log('   ✅ S3 is configured')
  } else {
    console.log('   ❌ S3 is NOT configured!')
    console.log('   ⚠️  Cannot safely delete images without S3')
    process.exit(1)
  }

  // Check 2: Runtime usage
  console.log('\n2️⃣ Checking for direct filesystem access...')
  const issues = checkRuntimeUsage()
  if (issues.length === 0) {
    console.log('   ✅ No direct filesystem access found in runtime code')
  } else {
    console.log('   ⚠️  Found potential issues:')
    issues.forEach(issue => console.log(`      - ${issue}`))
  }

  // Check 3: Image URL helpers
  console.log('\n3️⃣ Checking image URL usage...')
  const usage = checkImageUsage()
  console.log(`   ✅ Found ${usage.usesGetImageUrl} files using getImageUrl() helper`)
  if (usage.usesDirectPath > 0) {
    console.log(`   ⚠️  Found ${usage.usesDirectPath} files that might use direct paths`)
  }

  // Check 4: Critical files exist
  console.log('\n4️⃣ Checking critical files...')
  const criticalFiles = [
    'public/fonts/NotoSansHebrew-Regular.ttf',
    'public/fonts/NotoSansHebrew-Bold.ttf',
    'public/logo-transparent.png',
    'public/logo.png',
    'public/favicon.svg',
    'public/data/profiles.json',
  ]

  let allCriticalExist = true
  criticalFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file)
    if (fs.existsSync(filePath)) {
      console.log(`   ✅ ${file}`)
    } else {
      console.log(`   ⚠️  ${file} - NOT FOUND`)
      allCriticalExist = false
    }
  })

  // Final verdict
  console.log('\n' + '='.repeat(50))
  if (s3Check.configured && issues.length === 0 && allCriticalExist) {
    console.log('✅ SAFE TO DELETE public/images/')
    console.log('\nYou can run: npm run delete:public-images')
  } else {
    console.log('⚠️  REVIEW NEEDED before deletion')
    if (!s3Check.configured) {
      console.log('   - Configure S3 first')
    }
    if (issues.length > 0) {
      console.log('   - Fix filesystem access issues')
    }
    if (!allCriticalExist) {
      console.log('   - Some critical files are missing')
    }
  }
  console.log('='.repeat(50))
}

main().catch(console.error)

