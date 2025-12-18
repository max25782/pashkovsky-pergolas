/**
 * Tests for Lead Scoring
 * 
 * Run with: npx tsx lib/leads/__tests__/scoring.test.ts
 */

import { scoreLeadRules, mergeScores, getScoreCategory } from '../scoring'
import type { Lead } from '@/components/admin/lead-types'

// Test data
const testLeadHot: Lead = {
  id: '1',
  name: 'John Doe',
  phone: '0501234567',
  city: 'Tel Aviv',
  email: 'john@example.com',
  source: 'facebook',
  status: 'qualified',
  notes: 'Хочу перголу 4x6 метров с сантефом. Готов к покупке в ближайшее время.',
  created_at: new Date().toISOString(),
}

const testLeadWarm: Lead = {
  id: '2',
  name: 'Jane Smith',
  phone: '0507654321',
  city: 'Jerusalem',
  source: 'google',
  status: 'contacted',
  notes: 'Интересуюсь перголой',
  created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
}

const testLeadCold: Lead = {
  id: '3',
  name: 'Bob',
  phone: '050',
  source: null,
  status: 'pending',
  notes: '',
  created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
}

function testScoreRules() {
  console.log('\n=== Testing scoreLeadRules ===')

  // Hot lead
  const hotResult = scoreLeadRules(testLeadHot, {
    isDuplicate: false,
    responseTimeMinutes: 30, // 30 minutes
    hasAttachments: false,
  })

  console.log(`Hot lead score: ${hotResult.scoreRule}`)
  console.log(`Reasons: ${hotResult.reasons.length}`)
  
  if (hotResult.scoreRule >= 80) {
    console.log('✅ PASS: Hot lead scored correctly')
  } else {
    console.log(`❌ FAIL: Expected >= 80, got ${hotResult.scoreRule}`)
    process.exit(1)
  }

  // Warm lead
  const warmResult = scoreLeadRules(testLeadWarm, {
    isDuplicate: false,
    responseTimeMinutes: null,
    hasAttachments: false,
  })

  console.log(`Warm lead score: ${warmResult.scoreRule}`)
  
  if (warmResult.scoreRule >= 50 && warmResult.scoreRule < 80) {
    console.log('✅ PASS: Warm lead scored correctly')
  } else {
    console.log(`❌ FAIL: Expected 50-79, got ${warmResult.scoreRule}`)
    process.exit(1)
  }

  // Cold lead
  const coldResult = scoreLeadRules(testLeadCold, {
    isDuplicate: false,
    responseTimeMinutes: null,
    hasAttachments: false,
  })

  console.log(`Cold lead score: ${coldResult.scoreRule}`)
  
  if (coldResult.scoreRule < 50) {
    console.log('✅ PASS: Cold lead scored correctly')
  } else {
    console.log(`❌ FAIL: Expected < 50, got ${coldResult.scoreRule}`)
    process.exit(1)
  }

  // Duplicate penalty
  const duplicateResult = scoreLeadRules(testLeadHot, {
    isDuplicate: true,
    responseTimeMinutes: 30,
    hasAttachments: false,
  })

  console.log(`Duplicate lead score: ${duplicateResult.scoreRule}`)
  
  if (duplicateResult.scoreRule < hotResult.scoreRule) {
    console.log('✅ PASS: Duplicate penalty applied')
  } else {
    console.log('❌ FAIL: Duplicate penalty not applied')
    process.exit(1)
  }
}

function testMergeScores() {
  console.log('\n=== Testing mergeScores ===')

  const ruleScore = 75
  const aiDelta = 5
  const finalScore = mergeScores(ruleScore, aiDelta)

  console.log(`Rule: ${ruleScore}, AI: +${aiDelta}, Final: ${finalScore}`)
  
  if (finalScore === 80) {
    console.log('✅ PASS: Scores merged correctly')
  } else {
    console.log(`❌ FAIL: Expected 80, got ${finalScore}`)
    process.exit(1)
  }

  // Test bounds
  const tooHigh = mergeScores(95, 10)
  if (tooHigh === 100) {
    console.log('✅ PASS: Score capped at 100')
  } else {
    console.log(`❌ FAIL: Expected 100, got ${tooHigh}`)
    process.exit(1)
  }

  const tooLow = mergeScores(5, -10)
  if (tooLow === 0) {
    console.log('✅ PASS: Score floored at 0')
  } else {
    console.log(`❌ FAIL: Expected 0, got ${tooLow}`)
    process.exit(1)
  }
}

function testScoreCategory() {
  console.log('\n=== Testing getScoreCategory ===')

  const hot = getScoreCategory(85)
  const warm = getScoreCategory(65)
  const cold = getScoreCategory(30)

  if (hot === 'Hot' && warm === 'Warm' && cold === 'Cold') {
    console.log('✅ PASS: Categories assigned correctly')
  } else {
    console.log(`❌ FAIL: Expected Hot/Warm/Cold, got ${hot}/${warm}/${cold}`)
    process.exit(1)
  }
}

// Run all tests
console.log('🧪 Running lead scoring tests...\n')

try {
  testScoreRules()
  testMergeScores()
  testScoreCategory()
  
  console.log('\n✅ All tests passed!')
  console.log('📊 Lead scoring is working correctly.')
} catch (error: any) {
  console.error('\n❌ Test failed:', error.message)
  process.exit(1)
}

