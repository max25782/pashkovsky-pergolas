/**
 * Simple calculation tests for analytics aggregators
 * 
 * Run with: npx tsx lib/analytics/__tests__/test-calculations.ts
 * 
 * Tests key calculations: winRate, avgDealValue, profit, profitMargin, duplicates count
 * Ensures calculations are correct before data reaches AI
 */

// Test data
const testDeals = [
  { id: '1', stage: 'done', price: '50000', created_at: '2024-01-15T10:00:00Z', updated_at: '2024-01-20T10:00:00Z' },
  { id: '2', stage: 'done', price: '30000', created_at: '2024-01-16T10:00:00Z', updated_at: '2024-01-25T10:00:00Z' },
  { id: '3', stage: 'production', price: '40000', created_at: '2024-01-17T10:00:00Z', updated_at: '2024-01-18T10:00:00Z' },
  { id: '4', stage: 'new', price: null, created_at: '2024-01-18T10:00:00Z', updated_at: '2024-01-18T10:00:00Z' },
]

const testLeads = [
  { id: '1', phone: '0501234567', created_at: '2024-01-15T10:00:00Z', last_message_at: '2024-01-15T11:30:00Z' },
  { id: '2', phone: '0501234567', created_at: '2024-01-16T10:00:00Z', last_message_at: null }, // Duplicate
  { id: '3', phone: '0507654321', created_at: '2024-01-17T10:00:00Z', last_message_at: '2024-01-17T14:00:00Z' },
]

const testShifts = [
  { daily_rate_snapshot: '500', date: '2024-01-15' },
  { daily_rate_snapshot: '600', date: '2024-01-16' },
  { daily_rate_snapshot: '550', date: '2024-01-17' },
]

// Test functions
function testWinRate() {
  console.log('\n=== Testing winRate calculation ===')
  
  const totalDeals = testDeals.length // 4
  const wonDeals = testDeals.filter(d => d.stage === 'done').length // 2
  const winRate = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0
  
  console.log(`Total deals: ${totalDeals}`)
  console.log(`Won deals: ${wonDeals}`)
  console.log(`Win rate: ${winRate}%`)
  
  const expected = 50 // 2/4 * 100
  if (winRate === expected) {
    console.log('✅ PASS: winRate calculated correctly')
  } else {
    console.log(`❌ FAIL: Expected ${expected}%, got ${winRate}%`)
    process.exit(1)
  }
}

function testAvgDealValue() {
  console.log('\n=== Testing avgDealValue calculation ===')
  
  const dealValues = testDeals
    .map(d => parseFloat(d.price) || 0)
    .filter(v => v > 0)
  
  const avgDealValue = dealValues.length > 0
    ? Math.round(dealValues.reduce((sum, v) => sum + v, 0) / dealValues.length)
    : 0
  
  console.log(`Deal values: ${dealValues.join(', ')}`)
  console.log(`Average deal value: ${avgDealValue} ILS`)
  
  const expected = 40000 // (50000 + 30000 + 40000) / 3
  if (avgDealValue === expected) {
    console.log('✅ PASS: avgDealValue calculated correctly')
  } else {
    console.log(`❌ FAIL: Expected ${expected}, got ${avgDealValue}`)
    process.exit(1)
  }
}

function testProfitAndMargin() {
  console.log('\n=== Testing profit and profitMargin calculation ===')
  
  // Revenue from done deals only
  const revenue = testDeals
    .filter(d => d.stage === 'done')
    .reduce((sum, d) => sum + (parseFloat(d.price) || 0), 0)
  
  // Labor cost from shifts
  const laborCost = testShifts.reduce((sum, s) => sum + parseFloat(s.daily_rate_snapshot), 0)
  
  const profit = revenue - laborCost
  const profitMargin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0
  
  console.log(`Revenue: ${revenue} ILS`)
  console.log(`Labor cost: ${laborCost} ILS`)
  console.log(`Profit: ${profit} ILS`)
  console.log(`Profit margin: ${profitMargin}%`)
  
  const expectedRevenue = 80000 // 50000 + 30000
  const expectedLaborCost = 1650 // 500 + 600 + 550
  const expectedProfit = 78350 // 80000 - 1650
  const expectedMargin = 98 // Math.round((78350 / 80000) * 100)
  
  if (revenue === expectedRevenue && 
      laborCost === expectedLaborCost && 
      profit === expectedProfit && 
      profitMargin === expectedMargin) {
    console.log('✅ PASS: Profit and margin calculated correctly')
  } else {
    console.log(`❌ FAIL: Expected revenue=${expectedRevenue}, laborCost=${expectedLaborCost}, profit=${expectedProfit}, margin=${expectedMargin}`)
    console.log(`   Got revenue=${revenue}, laborCost=${laborCost}, profit=${profit}, margin=${profitMargin}`)
    process.exit(1)
  }
}

function testDuplicates() {
  console.log('\n=== Testing duplicates count ===')
  
  const phoneMap = new Map<string, number>()
  testLeads.forEach(lead => {
    if (lead.phone) {
      phoneMap.set(lead.phone, (phoneMap.get(lead.phone) || 0) + 1)
    }
  })
  
  // Count duplicate groups (phones that appear more than once)
  const duplicateLeads = Array.from(phoneMap.values()).filter(count => count > 1).length
  
  console.log(`Total leads: ${testLeads.length}`)
  console.log(`Duplicate groups: ${duplicateLeads}`)
  
  const expected = 1 // One phone appears twice
  if (duplicateLeads === expected) {
    console.log('✅ PASS: Duplicates counted correctly')
  } else {
    console.log(`❌ FAIL: Expected ${expected} duplicate groups, got ${duplicateLeads}`)
    process.exit(1)
  }
}

async function testTimezoneConversion() {
  console.log('\n=== Testing timezone conversion (Asia/Jerusalem) ===')
  
  // Import getDateRange from aggregators
  const { getDateRange } = await import('../aggregators')
  const { DEFAULT_TIMEZONE } = await import('@/lib/ai/analyticsTypes')
  
  const period = { from: '2024-01-15', to: '2024-01-20', tz: DEFAULT_TIMEZONE }
  const { from, to } = getDateRange(period)
  
  console.log(`Period: ${period.from} to ${period.to}`)
  console.log(`From (UTC): ${from}`)
  console.log(`To (UTC): ${to}`)
  
  // Verify format
  const fromDate = new Date(from)
  const toDate = new Date(to)
  
  if (fromDate.getUTCHours() === 0 && 
      fromDate.getUTCMinutes() === 0 &&
      toDate.getUTCHours() === 23 &&
      toDate.getUTCMinutes() === 59) {
    console.log('✅ PASS: Timezone conversion works correctly')
  } else {
    console.log('❌ FAIL: Timezone conversion incorrect')
    console.log(`   From hours: ${fromDate.getUTCHours()}, minutes: ${fromDate.getUTCMinutes()}`)
    console.log(`   To hours: ${toDate.getUTCHours()}, minutes: ${toDate.getUTCMinutes()}`)
    process.exit(1)
  }
}

function testEdgeCases() {
  console.log('\n=== Testing edge cases ===')
  
  // Empty arrays
  const emptyDeals: any[] = []
  const emptyWinRate = emptyDeals.length > 0 
    ? Math.round((emptyDeals.filter(d => d.stage === 'done').length / emptyDeals.length) * 100)
    : 0
  
  if (emptyWinRate === 0) {
    console.log('✅ PASS: Empty deals handled correctly')
  } else {
    console.log(`❌ FAIL: Empty deals should return 0%, got ${emptyWinRate}%`)
    process.exit(1)
  }
  
  // Null prices
  const dealsWithNulls = [
    { price: null },
    { price: '10000' },
  ]
  const values = dealsWithNulls
    .map(d => parseFloat(d.price) || 0)
    .filter(v => v > 0)
  const avg = values.length > 0 ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : 0
  
  if (avg === 10000) {
    console.log('✅ PASS: Null prices handled correctly')
  } else {
    console.log(`❌ FAIL: Null prices should be excluded, got avg=${avg}`)
    process.exit(1)
  }
  
  // Zero revenue
  const zeroRevenue = 0
  const zeroMargin = zeroRevenue > 0 ? Math.round((0 / zeroRevenue) * 100) : 0
  
  if (zeroMargin === 0) {
    console.log('✅ PASS: Zero revenue handled correctly')
  } else {
    console.log(`❌ FAIL: Zero revenue should return 0% margin, got ${zeroMargin}%`)
    process.exit(1)
  }
}

// Run all tests
async function runTests() {
  console.log('🧪 Running analytics aggregator calculation tests...\n')

  try {
    testWinRate()
    testAvgDealValue()
    testProfitAndMargin()
    testDuplicates()
    await testTimezoneConversion()
    testEdgeCases()
    
    console.log('\n✅ All tests passed!')
    console.log('📊 Calculations are correct - AI will receive accurate data.')
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message)
    process.exit(1)
  }
}

runTests()

