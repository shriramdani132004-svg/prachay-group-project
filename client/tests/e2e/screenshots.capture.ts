import { test } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { installApiMocks } from './mocks'

/**
 * Phase 10 screenshot capture (M9).
 *
 * Deliberately named `*.capture.ts` (NOT `*.spec.ts`) so it never joins the
 * 33-test regression suite — running it is an explicit, separate step:
 *
 *   npx playwright test tests/e2e/screenshots.capture.ts
 *
 * Screenshots are written to docs/screenshots/ at the repository root and
 * depict the UI under the SAME documented mock harness the E2E suite uses
 * (route interception; application code contains no fake identity).
 */

const SHOTS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'docs',
  'screenshots',
)

const VIEWPORT = { width: 1440, height: 900 }

async function shoot(page: import('@playwright/test').Page, name: string) {
  await page.waitForTimeout(400) // settle animations
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: true })
}

test.describe('screenshots', () => {
  test.setTimeout(120_000)

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT)
  })

  test('01 login page (anonymous)', async ({ page }) => {
    await installApiMocks(page, null)
    await page.goto('/login')
    await shoot(page, '01-login')
  })

  test('02 employee dashboard', async ({ page }) => {
    await installApiMocks(page, 'EMPLOYEE')
    await page.goto('/employee')
    await shoot(page, '02-employee-dashboard')
  })

  test('03 employee voucher list', async ({ page }) => {
    await installApiMocks(page, 'EMPLOYEE')
    await page.goto('/employee/vouchers')
    await shoot(page, '03-employee-voucher-list')
  })

  test('04 employee create voucher with signature pad', async ({ page }) => {
    await installApiMocks(page, 'EMPLOYEE')
    await page.goto('/employee/vouchers/new')
    await shoot(page, '04-employee-create-voucher')
  })

  test('05 employee voucher detail', async ({ page }) => {
    await installApiMocks(page, 'EMPLOYEE')
    await page.goto('/employee/vouchers/vch-001')
    await shoot(page, '05-employee-voucher-detail')
  })

  test('06 director dashboard', async ({ page }) => {
    await installApiMocks(page, 'DIRECTOR')
    await page.goto('/director')
    await shoot(page, '06-director-dashboard')
  })

  test('07 director approval queue', async ({ page }) => {
    await installApiMocks(page, 'DIRECTOR')
    await page.goto('/director/approvals')
    await shoot(page, '07-director-approval-queue')
  })

  test('08 director voucher review', async ({ page }) => {
    await installApiMocks(page, 'DIRECTOR')
    await page.goto('/director/vouchers/vch-001')
    await shoot(page, '08-director-voucher-review')
  })

  test('09 accounts dashboard', async ({ page }) => {
    await installApiMocks(page, 'ACCOUNTS')
    await page.goto('/accounts')
    await shoot(page, '09-accounts-dashboard')
  })

  test('10 accounts voucher register', async ({ page }) => {
    await installApiMocks(page, 'ACCOUNTS')
    await page.goto('/accounts/vouchers')
    await shoot(page, '10-accounts-voucher-register')
  })

  test('11 accounts voucher detail', async ({ page }) => {
    await installApiMocks(page, 'ACCOUNTS')
    await page.goto('/accounts/vouchers/vch-001')
    await shoot(page, '11-accounts-voucher-detail')
  })

  test('12 not found page', async ({ page }) => {
    await installApiMocks(page, 'EMPLOYEE')
    await page.goto('/no-such-route')
    await shoot(page, '12-not-found')
  })
})
