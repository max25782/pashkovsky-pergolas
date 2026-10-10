/**
 * Runs before every test file (jest setupFiles). Last line of defence: whatever a test
 * or its environment configures, a call to a hosted Supabase project is refused before
 * it leaves the process. Tests that mock supabase-js are not affected.
 */

import { assertFetchAllowed } from '../helpers/integration-guard'

const realFetch = globalThis.fetch

if (typeof realFetch === 'function') {
  globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    try {
      assertFetchAllowed(input)
    } catch (error) {
      return Promise.reject(error)
    }
    return realFetch(input, init)
  }) as typeof fetch
}
