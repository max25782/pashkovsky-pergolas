/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  // No .env file is loaded here on purpose: a suite that needs a database must be given
  // its variables explicitly (see tests/helpers/integration-guard.ts).
  setupFiles: ['<rootDir>/tests/setup/block-remote-supabase.ts'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.spec.ts',
    '**/tests/**/*.test.ts',
    '**/tests/**/*.spec.ts',
  ],
  // Vitest suites (cut-list + pin-contour paths) — run via `npm run test:cutlist`.
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/lib/pergolas/__tests__/pin-contour-reference-paths\\.test\\.ts$',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'lib/**/*.ts',
    '!lib/**/*.d.ts',
    '!lib/**/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  // Transform TypeScript files
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
}
