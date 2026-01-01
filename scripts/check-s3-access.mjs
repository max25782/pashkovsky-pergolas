#!/usr/bin/env node
/**
 * Check S3 bucket access settings
 */

import { 
  S3Client, 
  GetBucketPolicyCommand,
  GetPublicAccessBlockCommand,
  GetBucketAclCommand
} from '@aws-sdk/client-s3'
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

console.log('🔍 Checking S3 access configuration...\n')
console.log(`Bucket: ${S3_BUCKET}`)
console.log(`Region: ${S3_REGION}\n`)

// Check Bucket Policy
console.log('📋 Bucket Policy:')
try {
  const policyCmd = new GetBucketPolicyCommand({ Bucket: S3_BUCKET })
  const policy = await s3Client.send(policyCmd)
  const policyJson = JSON.parse(policy.Policy)
  console.log(JSON.stringify(policyJson, null, 2))
} catch (error) {
  if (error.name === 'NoSuchBucketPolicy') {
    console.log('   ⚠️  No bucket policy set')
  } else {
    console.error('   ❌ Error:', error.message)
  }
}
console.log()

// Check Public Access Block
console.log('🔒 Public Access Block Settings:')
try {
  const blockCmd = new GetPublicAccessBlockCommand({ Bucket: S3_BUCKET })
  const block = await s3Client.send(blockCmd)
  console.log(JSON.stringify(block.PublicAccessBlockConfiguration, null, 2))
} catch (error) {
  if (error.name === 'NoSuchPublicAccessBlockConfiguration') {
    console.log('   ✅ No public access block (public access allowed)')
  } else {
    console.error('   ❌ Error:', error.message)
  }
}
console.log()

// Check Bucket ACL
console.log('👥 Bucket ACL:')
try {
  const aclCmd = new GetBucketAclCommand({ Bucket: S3_BUCKET })
  const acl = await s3Client.send(aclCmd)
  console.log('Owner:', acl.Owner)
  console.log('Grants:')
  acl.Grants?.forEach((grant, i) => {
    console.log(`  ${i + 1}. ${grant.Grantee?.Type}: ${grant.Grantee?.URI || grant.Grantee?.ID || grant.Grantee?.DisplayName} - ${grant.Permission}`)
  })
} catch (error) {
  console.error('   ❌ Error:', error.message)
}
console.log()

console.log('💡 Recommendations:')
console.log('   - Bucket Policy should allow public GetObject')
console.log('   - Public Access Block should be disabled OR allow GetObject')
console.log('   - CORS configuration should allow your domain')




