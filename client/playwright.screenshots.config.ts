import { defineConfig } from '@playwright/test'
import base from './playwright.config'

/**
 * Phase 10 screenshot capture config (M9).
 *
 * Runs ONLY tests/e2e/screenshots.capture.ts so the 33-test regression suite
 * stays untouched. Usage:
 *
 *   npx playwright test --config playwright.screenshots.config.ts
 */
export default defineConfig({
  ...base,
  testDir: './tests/e2e',
  testMatch: /screenshots\.capture\.ts/,
  reporter: [['list']],
})
