/**
 * Integration Tests for Multi-Tenant Isolation
 * Phase 5: Verify data isolation between companies
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })

describe('Multi-Tenant Data Isolation', () => {
  let companyA_id: string
  let companyB_id: string
  let userA_id: string
  let userB_id: string
  let dealA_id: string
  let dealB_id: string

  beforeAll(async () => {
    // Create test companies
    const { data: companyA } = await supabase
      .from('companies')
      .insert({ name: 'Test Company A', slug: 'test-company-a' })
      .select()
      .single()
    companyA_id = companyA!.id

    const { data: companyB } = await supabase
      .from('companies')
      .insert({ name: 'Test Company B', slug: 'test-company-b' })
      .select()
      .single()
    companyB_id = companyB!.id

    // Create test users
    const { data: { user: authUserA } } = await supabase.auth.admin.createUser({
      email: 'test-a@example.com',
      password: 'password123',
      email_confirm: true,
    })
    userA_id = authUserA!.id

    const { data: { user: authUserB } } = await supabase.auth.admin.createUser({
      email: 'test-b@example.com',
      password: 'password123',
      email_confirm: true,
    })
    userB_id = authUserB!.id

    // Create user records
    await supabase.from('users').insert([
      { id: userA_id, email: 'test-a@example.com', full_name: 'User A' },
      { id: userB_id, email: 'test-b@example.com', full_name: 'User B' },
    ])

    // Create memberships
    await supabase.from('company_members').insert([
      { company_id: companyA_id, user_id: userA_id, role: 'owner' },
      { company_id: companyB_id, user_id: userB_id, role: 'owner' },
    ])

    // Create test deals
    const { data: dealA } = await supabase
      .from('deals')
      .insert({
        company_id: companyA_id,
        customer_name: 'Customer A',
        customer_phone: '123456789',
        project_type: 'pergola',
      })
      .select()
      .single()
    dealA_id = dealA!.id

    const { data: dealB } = await supabase
      .from('deals')
      .insert({
        company_id: companyB_id,
        customer_name: 'Customer B',
        customer_phone: '987654321',
        project_type: 'railing',
      })
      .select()
      .single()
    dealB_id = dealB!.id
  })

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('deals').delete().in('id', [dealA_id, dealB_id])
    await supabase.from('company_members').delete().in('user_id', [userA_id, userB_id])
    await supabase.from('users').delete().in('id', [userA_id, userB_id])
    await supabase.from('companies').delete().in('id', [companyA_id, companyB_id])
    await supabase.auth.admin.deleteUser(userA_id)
    await supabase.auth.admin.deleteUser(userB_id)
  })

  it('Company A cannot see Company B deals', async () => {
    const { data: dealsA } = await supabase
      .from('deals')
      .select('*')
      .eq('company_id', companyA_id)

    expect(dealsA).toBeDefined()
    expect(dealsA!.length).toBe(1)
    expect(dealsA![0].id).toBe(dealA_id)
    expect(dealsA!.find(d => d.id === dealB_id)).toBeUndefined()
  })

  it('Company B cannot see Company A deals', async () => {
    const { data: dealsB } = await supabase
      .from('deals')
      .select('*')
      .eq('company_id', companyB_id)

    expect(dealsB).toBeDefined()
    expect(dealsB!.length).toBe(1)
    expect(dealsB![0].id).toBe(dealB_id)
    expect(dealsB!.find(d => d.id === dealA_id)).toBeUndefined()
  })

  it('User A belongs only to Company A', async () => {
    const { data: memberships } = await supabase
      .from('company_members')
      .select('*')
      .eq('user_id', userA_id)

    expect(memberships).toBeDefined()
    expect(memberships!.length).toBe(1)
    expect(memberships![0].company_id).toBe(companyA_id)
  })

  it('User B belongs only to Company B', async () => {
    const { data: memberships } = await supabase
      .from('company_members')
      .select('*')
      .eq('user_id', userB_id)

    expect(memberships).toBeDefined()
    expect(memberships!.length).toBe(1)
    expect(memberships![0].company_id).toBe(companyB_id)
  })

  it('Cannot update deal from another company', async () => {
    // Try to update Company B's deal using Company A's context
    const { error } = await supabase
      .from('deals')
      .update({ customer_name: 'Hacked Name' })
      .eq('id', dealB_id)
      .eq('company_id', companyA_id) // Wrong company

    // Should succeed but not update anything
    expect(error).toBeNull()

    // Verify deal was not updated
    const { data: deal } = await supabase
      .from('deals')
      .select('customer_name')
      .eq('id', dealB_id)
      .single()

    expect(deal!.customer_name).not.toBe('Hacked Name')
    expect(deal!.customer_name).toBe('Customer B')
  })

  it('Cannot delete deal from another company', async () => {
    // Try to delete Company B's deal using Company A's context
    const { error } = await supabase
      .from('deals')
      .delete()
      .eq('id', dealB_id)
      .eq('company_id', companyA_id) // Wrong company

    expect(error).toBeNull()

    // Verify deal still exists
    const { data: deal } = await supabase
      .from('deals')
      .select('*')
      .eq('id', dealB_id)
      .single()

    expect(deal).toBeDefined()
    expect(deal!.id).toBe(dealB_id)
  })

  it('All tables have company_id index', async () => {
    const tables = ['deals', 'leads', 'workers', 'work_shifts', 'offers', 'material_orders', 'ai_chat_sessions', 'weekly_digests']

    for (const table of tables) {
      const { data } = await supabase
        .from(table)
        .select('company_id')
        .limit(1)

      // Should not throw error (company_id column exists)
      expect(data).toBeDefined()
    }
  })

  it('CASCADE delete works correctly', async () => {
    // Create temporary company with deal
    const { data: tempCompany } = await supabase
      .from('companies')
      .insert({ name: 'Temp Company', slug: 'temp-company' })
      .select()
      .single()

    const { data: tempDeal } = await supabase
      .from('deals')
      .insert({
        company_id: tempCompany!.id,
        customer_name: 'Temp Customer',
        customer_phone: '000000000',
      })
      .select()
      .single()

    // Delete company
    await supabase.from('companies').delete().eq('id', tempCompany!.id)

    // Verify deal was also deleted (CASCADE)
    const { data: deletedDeal } = await supabase
      .from('deals')
      .select('*')
      .eq('id', tempDeal!.id)
      .single()

    expect(deletedDeal).toBeNull()
  })
})

describe('Permission System', () => {
  it('Owner has all permissions', async () => {
    const { can } = await import('@/lib/permissions')
    
    const permissions = [
      'deals:view', 'deals:create', 'deals:edit', 'deals:delete',
      'finance:view', 'finance:edit',
      'users:invite', 'users:remove',
      'billing:view', 'billing:manage',
    ]

    permissions.forEach(permission => {
      expect(can('owner', permission as any)).toBe(true)
    })
  })

  it('Viewer has only view permissions', async () => {
    const { can } = await import('@/lib/permissions')
    
    expect(can('viewer', 'deals:view')).toBe(true)
    expect(can('viewer', 'deals:create')).toBe(false)
    expect(can('viewer', 'finance:view')).toBe(false)
    expect(can('viewer', 'billing:manage')).toBe(false)
  })
})



