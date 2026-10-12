// Run: node --test scripts/set-user-password.test.mjs
// Talks only to a mock GoTrue admin API on 127.0.0.1; never to a real project.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkTarget, generatePassword } from './set-user-password.mjs'

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'set-user-password.mjs')
const EXISTING_EMAIL = 'Existing.User@Example.test'
const USER_ID = '11111111-1111-1111-1111-111111111111'

let server
let baseUrl
const requests = []

before(async () => {
  server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      requests.push({ method: req.method, url: req.url, body })
      res.setHeader('content-type', 'application/json')
      if (req.method === 'GET' && req.url.startsWith('/auth/v1/admin/users')) {
        res.end(JSON.stringify({
          users: [{ id: USER_ID, email: EXISTING_EMAIL.toLowerCase(), aud: 'authenticated' }],
          aud: 'authenticated',
        }))
      } else if (req.method === 'PUT' && req.url === `/auth/v1/admin/users/${USER_ID}`) {
        res.end(JSON.stringify({ id: USER_ID, email: EXISTING_EMAIL.toLowerCase(), aud: 'authenticated' }))
      } else {
        res.statusCode = 404
        res.end(JSON.stringify({ message: 'not found' }))
      }
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(() => server.close())

function run(args, env = {}) {
  const cwd = mkdtempSync(path.join(tmpdir(), 'setpw-'))
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], {
      cwd,
      env: { PATH: process.env.PATH, SUPABASE_URL: baseUrl, SUPABASE_SERVICE_ROLE_KEY: 'service-key-for-mock', ...env },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => { stdout += d })
    child.stderr.on('data', (d) => { stderr += d })
    child.on('close', (code) => resolve({ code, stdout, stderr, cwd }))
  })
}

test('refuses without --expect-ref and makes no request', async () => {
  requests.length = 0
  const r = await run([EXISTING_EMAIL])
  assert.equal(r.code, 2)
  assert.equal(requests.length, 0)
})

test('refuses a hosted URL whose project differs from --expect-ref, before any request', async () => {
  const r = await run([EXISTING_EMAIL, '--expect-ref', 'kvqupacmdishpfnscnio', '--confirm'], {
    SUPABASE_URL: 'https://otherprojectref.supabase.co',
  })
  assert.equal(r.code, 2)
  assert.match(r.stderr, /does not match --expect-ref/)
})

test('refuses a local URL unless --expect-ref is "local"', async () => {
  requests.length = 0
  const r = await run([EXISTING_EMAIL, '--expect-ref', 'kvqupacmdishpfnscnio', '--confirm'])
  assert.equal(r.code, 2)
  assert.equal(requests.length, 0)
})

test('refuses when the service key or URL is missing', async () => {
  const r = await run([EXISTING_EMAIL, '--expect-ref', 'local'], { SUPABASE_SERVICE_ROLE_KEY: '' })
  assert.equal(r.code, 2)
})

test('dry run prints only "dry run", exits 0, and never calls update', async () => {
  requests.length = 0
  const r = await run([EXISTING_EMAIL, '--expect-ref', 'local'])
  assert.equal(r.code, 0)
  assert.equal(r.stdout, 'dry run\n')
  assert.equal(r.stderr, '')
  assert.equal(requests.some((q) => q.method === 'PUT'), false)
})

test('dry run for an unknown email exits 1 without echoing the email', async () => {
  requests.length = 0
  const r = await run(['nobody@example.test', '--expect-ref', 'local'])
  assert.equal(r.code, 1)
  assert.ok(!r.stdout.includes('nobody') && !r.stderr.includes('nobody'))
  assert.equal(requests.some((q) => q.method === 'PUT'), false)
})

test('--confirm updates the user, prints a 20-char password once, leaks nothing else', async () => {
  requests.length = 0
  const r = await run([EXISTING_EMAIL, '--expect-ref', 'local', '--confirm'])
  assert.equal(r.code, 0)

  const put = requests.filter((q) => q.method === 'PUT')
  assert.equal(put.length, 1)
  const sentPassword = JSON.parse(put[0].body).password
  assert.equal(sentPassword.length, 20)

  assert.equal(r.stdout, `${sentPassword}\n`)
  assert.equal(r.stdout.split(sentPassword).length - 1, 1)
  assert.ok(!r.stderr.includes(sentPassword))
  assert.ok(!r.stdout.toLowerCase().includes('example.test') && !r.stderr.toLowerCase().includes('example.test'))
  assert.deepEqual(readdirSync(r.cwd), [], 'no files may be written')
})

test('--confirm for an unknown email exits 1 and does not call update', async () => {
  requests.length = 0
  const r = await run(['nobody@example.test', '--expect-ref', 'local', '--confirm'])
  assert.equal(r.code, 1)
  assert.equal(r.stdout, '')
  assert.equal(requests.some((q) => q.method === 'PUT'), false)
})

test('checkTarget accepts exactly <ref>.supabase.co and rejects lookalikes', () => {
  assert.equal(checkTarget('https://kvqupacmdishpfnscnio.supabase.co', 'kvqupacmdishpfnscnio'), null)
  assert.notEqual(checkTarget('https://kvqupacmdishpfnscnio.supabase.co.evil.test', 'kvqupacmdishpfnscnio'), null)
  assert.notEqual(checkTarget('https://evil-kvqupacmdishpfnscnio.supabase.co', 'kvqupacmdishpfnscnio'), null)
  assert.notEqual(checkTarget('https://kvqupacmdishpfnscnio.supabase.co', 'local'), null)
  assert.equal(checkTarget('http://127.0.0.1:54321', 'local'), null)
})

test('generatePassword: 20 chars, all classes, not constant', () => {
  const seen = new Set()
  for (let i = 0; i < 200; i += 1) {
    const p = generatePassword()
    assert.equal(p.length, 20)
    assert.match(p, /[a-z]/)
    assert.match(p, /[A-Z]/)
    assert.match(p, /[0-9]/)
    assert.match(p, /[^A-Za-z0-9]/)
    seen.add(p)
  }
  assert.equal(seen.size, 200)
})
