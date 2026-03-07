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

  // Hot lead
  const hotResult = scoreLeadRules(testLeadHot, {
    isDuplicate: false,
    responseTimeMinutes: 30, // 30 minutes
    hasAttachments: false,
  })

  
  if (hotResult.scoreRule >= 80) {
  } else {
    process.exit(1)
  }

  // Warm lead
  const warmResult = scoreLeadRules(testLeadWarm, {
    isDuplicate: false,
    responseTimeMinutes: null,
    hasAttachments: false,
  })

  
  if (warmResult.scoreRule >= 50 && warmResult.scoreRule < 80) {
  } else {
    process.exit(1)
  }

  // Cold lead
  const coldResult = scoreLeadRules(testLeadCold, {
    isDuplicate: false,
    responseTimeMinutes: null,
    hasAttachments: false,
  })

  
  if (coldResult.scoreRule < 50) {
  } else {
    process.exit(1)
  }

  // Duplicate penalty
  const duplicateResult = scoreLeadRules(testLeadHot, {
    isDuplicate: true,
    responseTimeMinutes: 30,
    hasAttachments: false,
  })

  
  if (duplicateResult.scoreRule < hotResult.scoreRule) {
  } else {
    process.exit(1)
  }
}

function testMergeScores() {

  const ruleScore = 75
  const aiDelta = 5
  const finalScore = mergeScores(ruleScore, aiDelta)

  
  if (finalScore === 80) {
  } else {
    process.exit(1)
  }

  // Test bounds
  const tooHigh = mergeScores(95, 10)
  if (tooHigh === 100) {
  } else {
    process.exit(1)
  }

  const tooLow = mergeScores(5, -10)
  if (tooLow === 0) {
  } else {
    process.exit(1)
  }
}

function testScoreCategory() {

  const hot = getScoreCategory(85)
  const warm = getScoreCategory(65)
  const cold = getScoreCategory(30)

  if (hot === 'Hot' && warm === 'Warm' && cold === 'Cold') {
  } else {
    process.exit(1)
  }
}

// Run all tests

try {
  testScoreRules()
  testMergeScores()
  testScoreCategory()
  
} catch (error) {
  console.error('\n❌ Test failed:', error.message)
  process.exit(1)
}

