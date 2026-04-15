/**
 * CSV Lead Import
 * POST /admin-api/leads/import
 * Accepts multipart/form-data with CSV file
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { normalizePhoneIL } from '@/lib/middleware/integration-access'

const supabase =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { db: { schema: 'public' } }
      )
    : undefined

// Column name aliases for flexible mapping (Facebook, Excel, etc.)
const NAME_KEYS = ['name', 'full_name', 'full name', 'first_name', 'first name', 'имя', 'שם']
const PHONE_KEYS = ['phone', 'phone_number', 'phone number', 'טלפון', 'телефон']
const EMAIL_KEYS = ['email', 'e-mail', 'אימייל', 'почта', 'электронный адрес']

function parseCSVLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
    } else if (c === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += c
    }
  }
  result.push(current.trim())
  return result
}

function detectDelimiter(firstLine: string): string {
  return firstLine.includes('\t') ? '\t' : ','
}

function findColumnIndex(headers: string[], keys: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim())
  for (const key of keys) {
    const idx = lower.indexOf(key.toLowerCase())
    if (idx >= 0) return idx
  }
  for (const key of keys) {
    const idx = lower.findIndex((h) => h.includes(key.toLowerCase()))
    if (idx >= 0) return idx
  }
  return -1
}

export async function POST(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error
  
  const companyId = authCheck.context.companyId ?? null
  if (!companyId) return NextResponse.json({ error: 'No company context' }, { status: 401 })
  
  if (!supabase) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })

  const formData = await req.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })

  const file = formData.get('file') as File | null
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const source = (formData.get('source') as string)?.trim() || 'facebook'

  const text = await file.text()
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) {
    return NextResponse.json({ error: 'CSV must have header row and at least one data row' }, { status: 400 })
  }

  const delimiter = detectDelimiter(lines[0])
  const headers = parseCSVLine(lines[0], delimiter)
  const nameIdx = findColumnIndex(headers, NAME_KEYS)
  const phoneIdx = findColumnIndex(headers, PHONE_KEYS)
  const emailIdx = findColumnIndex(headers, EMAIL_KEYS)

  if (nameIdx < 0 && phoneIdx < 0) {
    return NextResponse.json({
      error: 'CSV must have a name or phone column. Supported: name, full_name, phone, phone_number',
      headers: headers.slice(0, 10),
    }, { status: 400 })
  }

  const toInsert: Array<{
    company_id: string
    name: string
    phone: string
    email: string | null
    source: string
    status: string
    message: string | null
  }> = []
  const seenPhones = new Set<string>()

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i], delimiter)
    const name = (nameIdx >= 0 ? cells[nameIdx] : '')?.trim() || 'Unknown'
    const phoneRaw = (phoneIdx >= 0 ? cells[phoneIdx] : '')?.trim() || ''
    const phone = normalizePhoneIL(phoneRaw)
    const email = (emailIdx >= 0 ? cells[emailIdx] : '')?.trim() || null

    if (!phone || phone.length < 9) continue
    if (seenPhones.has(phone)) continue
    seenPhones.add(phone)

    toInsert.push({
      company_id: companyId,
      name,
      phone,
      email: email || null,
      source,
      status: 'waiting',
      message: null,
    })
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ error: 'No valid leads found (need name/phone, min 9 digits)' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('leads')
    .select('phone')
    .eq('company_id', companyId)
    .in('phone', toInsert.map((r) => r.phone))
  const existingPhones = new Set((existing ?? []).map((r) => r.phone))
  const newLeads = toInsert.filter((r) => !existingPhones.has(r.phone))

  if (newLeads.length === 0) {
    return NextResponse.json({ imported: 0, skipped: toInsert.length })
  }

  const { data, error } = await supabase
    .from('leads')
    .insert(newLeads)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ imported: data?.length ?? 0, skipped: toInsert.length - newLeads.length })
}
