import path from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Cut-list suites are written against vitest (`import { describe } from 'vitest'`), which jest
 * cannot load, so `npm test` (jest) never ran them. Run them with `npm run test:cutlist`.
 *
 * The root is the repository root on purpose: button-sheet-html resolves files through
 * process.cwd() ('apps/crm/...'), so the run has to start there. The script does the `cd`.
 * Jest ignores this file: its testMatch only picks `__tests__/*.test.ts` files.
 */
export default defineConfig({
  root: path.resolve(__dirname, '../..'),
  resolve: { alias: { '@': __dirname } },
  test: {
    environment: 'node',
    include: [
      'apps/crm/lib/cut-list/__tests__/**/*.test.ts',
      'apps/crm/lib/pergolas/__tests__/pin-contour-reference-paths.test.ts',
    ],
    // wall-beams-clockwise is a jest-style suite (global describe) and runs under `npm test`.
    exclude: ['**/wall-beams-clockwise.test.ts', '**/node_modules/**'],
  },
})
