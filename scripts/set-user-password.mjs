#!/usr/bin/env node
/**
 * Set a random password for ONE existing Supabase Auth user (owner recovery tool).
 *
 *   node --env-file=<path> scripts/set-user-password.mjs <email> --expect-ref <project-ref> [--confirm]
 *
 * Reads SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY from the
 * environment only; it never reads .env files itself (use node's --env-file).
 *
 * Safety rules, all enforced before any network call unless stated:
 *   - --expect-ref is mandatory and must match the project in the URL
 *       hosted:  hostname must be exactly "<ref>.supabase.co"
 *       local:   hostname localhost / 127.0.0.1 / ::1 and --expect-ref must be "local"
 *   - without --confirm it is a dry run: it only checks that the user exists
 *   - the password is generated here (20 chars, crypto.randomInt), printed ONCE to stdout
 *     and never written anywhere else; the email is never printed, logged or written.
 *
 * Exit codes: 0 ok, 1 user not found, 2 usage or safety refusal, 3 Supabase API error.
 */

import { randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const PASSWORD_LENGTH = 20
const PAGE_SIZE = 1000
const MAX_PAGES = 200
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const SYMBOLS = '!@#$%^*-_=+'
const ALL = LOWER + UPPER + DIGITS + SYMBOLS

function fail(code, message) {
  process.stderr.write(`${message}\n`)
  process.exit(code)
}

export function parseArgs(argv) {
  const args = { email: null, confirm: false, expectRef: null }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--confirm') args.confirm = true
    else if (arg === '--expect-ref') {
      args.expectRef = argv[i + 1] ?? null
      i += 1
    } else if (arg.startsWith('--expect-ref=')) args.expectRef = arg.slice('--expect-ref='.length)
    else if (arg.startsWith('--')) fail(2, `unknown option ${arg.split('=')[0]}`)
    else if (args.email === null) args.email = arg
    else fail(2, 'exactly one email argument is expected')
  }
  return args
}

/** Returns an error string when the URL does not match the expected ref, otherwise null. */
export function checkTarget(url, expectRef) {
  let host
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return 'SUPABASE_URL is not a valid URL'
  }
  if (LOCAL_HOSTS.has(host)) {
    return expectRef === 'local' ? null : 'URL is local: pass --expect-ref local'
  }
  if (expectRef === 'local') return 'URL is not local but --expect-ref is "local"'
  if (host !== `${expectRef}.supabase.co`) return 'project in SUPABASE_URL does not match --expect-ref'
  return null
}

export function generatePassword(length = PASSWORD_LENGTH) {
  const pick = (set) => set[randomInt(set.length)]
  // One of each class guaranteed, the rest uniform over the full alphabet.
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)]
  while (chars.length < length) chars.push(pick(ALL))
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

async function findUserId(admin, email) {
  const wanted = email.trim().toLowerCase()
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE })
    if (error) throw new Error(`listUsers failed (status ${error.status ?? 'n/a'})`)
    const users = data?.users ?? []
    const hit = users.find((u) => u.email?.toLowerCase() === wanted)
    if (hit) return hit.id
    if (users.length < PAGE_SIZE) return null
  }
  throw new Error('listUsers exceeded the page budget')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!args.email) fail(2, 'usage: set-user-password.mjs <email> --expect-ref <ref> [--confirm]')
  if (!args.expectRef) fail(2, 'refusing: --expect-ref is mandatory')

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) fail(2, 'refusing: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (use --env-file)')

  const targetError = checkTarget(url, args.expectRef)
  if (targetError) fail(2, `refusing: ${targetError}`)

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  let userId
  try {
    userId = await findUserId(admin, args.email)
  } catch (error) {
    fail(3, `supabase error: ${error instanceof Error ? error.message : 'unknown'}`)
  }
  if (!userId) fail(1, 'user not found')

  if (!args.confirm) {
    process.stdout.write('dry run\n')
    return
  }

  const password = generatePassword()
  const { error } = await admin.auth.admin.updateUserById(userId, { password })
  if (error) fail(3, `supabase error: update failed (status ${error.status ?? 'n/a'})`)

  process.stderr.write('password updated; shown once below, not stored anywhere\n')
  process.stdout.write(`${password}\n`)
}

import { fileURLToPath } from 'node:url'
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => fail(3, `unexpected error: ${error instanceof Error ? error.name : 'unknown'}`))
}
