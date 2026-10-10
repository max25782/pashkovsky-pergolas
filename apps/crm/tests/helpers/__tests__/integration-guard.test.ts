/**
 * The guard must refuse a production-looking target before any network call, skip
 * quietly when nothing is configured, and the jest setup must not load .env files.
 */

import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import {
  assertFetchAllowed,
  assertLocalUrl,
  isLocalUrl,
  NonLocalTargetError,
  readIntegrationEnv,
  readTestApiUrl,
} from '../integration-guard'

// A made-up hosted-looking URL. The tests below must never reach the network.
const FAKE_PROD_URL = 'https://abcdefghijklmnopqrst.supabase.co'
const FAKE_KEY = 'service-role-test-value'

describe('isLocalUrl', () => {
  it.each([
    'http://localhost:54321',
    'http://127.0.0.1:54321',
    'http://[::1]:54321',
    'http://LOCALHOST:3000/path',
  ])('accepts %s', (url) => {
    expect(isLocalUrl(url)).toBe(true)
  })

  it.each([
    FAKE_PROD_URL,
    'https://localhost.evil.example',
    'http://127.0.0.1.evil.example',
    'http://localhost@evil.example',
    'http://evil.example/?h=localhost',
    'http://0.0.0.0:54321',
    'not a url',
    '',
  ])('rejects %s', (url) => {
    expect(isLocalUrl(url)).toBe(false)
  })
})

describe('readIntegrationEnv', () => {
  it('returns null (skip) when nothing is configured', () => {
    expect(readIntegrationEnv({} as NodeJS.ProcessEnv)).toBeNull()
  })

  it('returns null (skip) when only the URL is configured', () => {
    expect(readIntegrationEnv({ SUPABASE_URL: 'http://127.0.0.1:54321' } as NodeJS.ProcessEnv)).toBeNull()
  })

  it('returns the configuration for a local URL', () => {
    expect(
      readIntegrationEnv({
        SUPABASE_URL: 'http://127.0.0.1:54321',
        SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY,
      } as NodeJS.ProcessEnv),
    ).toEqual({ url: 'http://127.0.0.1:54321', serviceKey: FAKE_KEY })
  })

  it.each(['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'])('throws for a production URL in %s', (name) => {
    expect(() =>
      readIntegrationEnv({ [name]: FAKE_PROD_URL, SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY } as NodeJS.ProcessEnv),
    ).toThrow(NonLocalTargetError)
  })

  it('throws when one URL is local and the other is not', () => {
    expect(() =>
      readIntegrationEnv({
        SUPABASE_URL: 'http://127.0.0.1:54321',
        NEXT_PUBLIC_SUPABASE_URL: FAKE_PROD_URL,
        SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY,
      } as NodeJS.ProcessEnv),
    ).toThrow(NonLocalTargetError)
  })

  it('throws even when the service key is missing (a wrong target is wrong regardless)', () => {
    expect(() => readIntegrationEnv({ SUPABASE_URL: FAKE_PROD_URL } as NodeJS.ProcessEnv)).toThrow(NonLocalTargetError)
  })

  it('does not put the host or the key into the error message', () => {
    try {
      readIntegrationEnv({ SUPABASE_URL: FAKE_PROD_URL, SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY } as NodeJS.ProcessEnv)
      throw new Error('expected a throw')
    } catch (error) {
      const message = (error as Error).message
      expect(message).not.toContain('abcdefghijklmnopqrst')
      expect(message).not.toContain(FAKE_KEY)
    }
  })
})

describe('readTestApiUrl', () => {
  it('is null when not set', () => {
    expect(readTestApiUrl({} as NodeJS.ProcessEnv)).toBeNull()
  })

  it('accepts a local server and refuses a remote one', () => {
    expect(readTestApiUrl({ TEST_API_URL: 'http://localhost:3000' } as NodeJS.ProcessEnv)).toBe('http://localhost:3000')
    expect(() => readTestApiUrl({ TEST_API_URL: 'https://crm.example.com' } as NodeJS.ProcessEnv)).toThrow(
      NonLocalTargetError,
    )
  })
})

describe('assertLocalUrl', () => {
  it('throws for a non-local URL and passes for a local one', () => {
    expect(() => assertLocalUrl(FAKE_PROD_URL, 'X')).toThrow(NonLocalTargetError)
    expect(() => assertLocalUrl('http://localhost:1', 'X')).not.toThrow()
  })
})

describe('global fetch guard (jest setup)', () => {
  it.each([
    `${FAKE_PROD_URL}/rest/v1/companies`,
    'https://x.supabase.in/auth/v1/user',
    'https://x.eu.supabase.co/rest/v1/deals',
  ])('refuses %s before the network is touched', (url) => {
    expect(() => assertFetchAllowed(url)).toThrow(NonLocalTargetError)
    expect(() => assertFetchAllowed(new URL(url))).toThrow(NonLocalTargetError)
    expect(() => assertFetchAllowed({ url })).toThrow(NonLocalTargetError)
  })

  it('lets other hosts through', () => {
    expect(() => assertFetchAllowed('http://localhost:54321/rest/v1/x')).not.toThrow()
    expect(() => assertFetchAllowed('https://example.com/supabase.co')).not.toThrow()
  })

  it('is installed: the real global fetch throws for a hosted Supabase URL and never opens a connection', async () => {
    // setupFiles replaced globalThis.fetch with the guarded wrapper. If it were not
    // installed this call would try to resolve the made-up host.
    await expect(globalThis.fetch(`${FAKE_PROD_URL}/rest/v1/companies`)).rejects.toThrow(NonLocalTargetError)
  })
})

describe('the integration suites themselves', () => {
  const crmRoot = path.resolve(__dirname, '../../..')
  const jestBin = require.resolve('jest/bin/jest')

  function runSuite(file: string, env: Record<string, string>) {
    return spawnSync(process.execPath, [jestBin, '--config', path.join(crmRoot, 'jest.config.js'), file], {
      cwd: crmRoot,
      encoding: 'utf8',
      timeout: 60_000,
      // Clean environment: nothing from the caller's shell leaks in.
      env: { PATH: process.env.PATH ?? '', ...env },
    })
  }

  const suites = [
    'tests/integration/multi-tenant.test.ts',
    'lib/offers/__tests__/allocate-offer-number.race.test.ts',
  ]

  it.each(suites)('%s fails before any network call when the Supabase URL is a production URL', (file) => {
    const result = runSuite(file, { SUPABASE_URL: FAKE_PROD_URL, SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY })
    const output = `${result.stdout}${result.stderr}`
    expect(result.status).not.toBe(0)
    expect(output).toContain('Refusing to run')
    // A network attempt on the made-up host would show up as a DNS or fetch error.
    expect(output).not.toMatch(/ENOTFOUND|getaddrinfo|fetch failed/)
  }, 90_000)

  it.each(suites)('%s is skipped, not failed, without configuration', (file) => {
    const result = runSuite(file, {})
    const output = `${result.stdout}${result.stderr}`
    expect(result.status).toBe(0)
    expect(output).toContain('skipped: set SUPABASE_URL')
  }, 90_000)

  it('the HTTP suite refuses a non-local TEST_API_URL and is skipped without one', () => {
    const refused = runSuite('tests/security/multi-tenant-isolation.test.ts', { TEST_API_URL: 'https://crm.example.com' })
    expect(refused.status).not.toBe(0)
    expect(`${refused.stdout}${refused.stderr}`).toContain('Refusing to run')

    const skipped = runSuite('tests/security/multi-tenant-isolation.test.ts', {})
    expect(skipped.status).toBe(0)
    expect(`${skipped.stdout}${skipped.stderr}`).toContain('skipped: set TEST_API_URL')
  }, 90_000)
})

describe('jest configuration', () => {
  const crmRoot = path.resolve(__dirname, '../../..')
  const config = fs.readFileSync(path.join(crmRoot, 'jest.config.js'), 'utf8')

  it('registers the setup file', () => {
    expect(config).toContain('tests/setup/block-remote-supabase.ts')
  })

  it('does not load .env files or dotenv', () => {
    const files = [
      'jest.config.js',
      'tests/setup/block-remote-supabase.ts',
      'tests/helpers/integration-guard.ts',
    ]
    for (const file of files) {
      const text = fs
        .readFileSync(path.join(crmRoot, file), 'utf8')
        .split('\n')
        .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*'))
        .join('\n')
      expect(text).not.toMatch(/dotenv|\.env\.local|loadEnvConfig|@next\/env/)
    }
  })
})
