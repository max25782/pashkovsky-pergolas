/**
 * Test Redis Connection
 * Run: npx tsx scripts/test-redis.ts
 */

import { config } from 'dotenv'
import { Redis } from '@upstash/redis'

// Load .env.local
config({ path: '.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
})

async function testRedis() {

  try {
    // Check credentials
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      console.error('❌ Missing Redis credentials in .env.local')
      console.error('\nAdd these to apps/crm/.env.local:')
      console.error('  UPSTASH_REDIS_REST_URL=https://...')
      console.error('  UPSTASH_REDIS_REST_TOKEN=...\n')
      process.exit(1)
    }

    // Test write
    await redis.set('test:connection', 'Hello from CRM!', { ex: 10 })

    // Test read
    const value = await redis.get('test:connection')

    // Test delete
    await redis.del('test:connection')

    // Test TTL
    await redis.set('test:ttl', 'expires soon', { ex: 5 })
    const ttl = await redis.ttl('test:ttl')
    await redis.del('test:ttl')

  } catch (error) {
    console.error('\n❌ Redis test failed:', error)
    console.error('\nTroubleshooting:')
    console.error('1. Check credentials in .env.local')
    console.error('2. Verify URL starts with https://')
    console.error('3. Ensure token is correct (no default: prefix)')
    console.error('4. Check Upstash dashboard for database status\n')
    process.exit(1)
  }
}

testRedis()

