import { defineConfig } from 'vitest/config'

/**
 * Two isolated projects:
 * - unit: pure logic, no database required.
 * - integration: real HTTP against the Express app via Supertest, and real
 *   PostgreSQL where explicitly needed.
 */
export default defineConfig({
  test: {
    // Shared Prisma pool across integration files: keep FILES sequential too
    // (one pool active at a time); without it each file opens its own pool and
    // the dev server's connection limit + bcrypt CPU cost starves the suite.
    fileParallelism: false,
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
          // bcrypt at work factor 12 is deliberately slow (~1-3s per hash on
          // this machine, more when the integration project runs concurrently).
          // The default 5s flaked under load; assertions are unchanged.
          testTimeout: 15_000,
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          testTimeout: 30_000,
          hookTimeout: 30_000,
          // Tests within a file run sequentially for deterministic assertions.
          sequence: { concurrent: false },
          env: {
            NODE_ENV: 'test',
            // Keep test output readable; real failures still surface via assertions.
            LOG_LEVEL: 'silent',
          },
        },
      },
    ],
  },
})