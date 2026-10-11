import { test, expect, type Page, type ConsoleMessage } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { installApiMocks, MOCK_VOUCHER } from './mocks'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(dirname, '../../test-results/screenshots')

/** Real voucher id used by the mock harness (see mocks.ts). */
const VOUCHER_ID = MOCK_VOUCHER.id

function ensureScreenshotDir() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

type Role = 'EMPLOYEE' | 'DIRECTOR' | 'ACCOUNTS'

/**
 * Playwright test-harness authentication + API mocks.
 *
 * Phases 5-9 replaced the Phase 2 demo role-preview with a real authentication
 * API and real voucher/analytics endpoints. These visual/regression tests mock
 * ALL `/api/v1/*` endpoints SOLELY inside the test harness (page.route). There
 * is deliberately NO authentication fallback in application code: outside
 * Playwright the app talks to the real backend or shows the logged-out state.
 *
 * The harness runs ONLY the Vite dev server (no backend), so every endpoint
 * the real pages call is intercepted with fixture data matching the real
 * envelope shapes.
 */

async function mockAuth(page: Page, role: Role | null): Promise<void> {
  await installApiMocks(page, role)
}

interface PageDiagnostics {
  pageErrors: string[]
  consoleErrors: string[]
  failedRequests: string[]
  /** Statuses of API responses observed, so expected 401s can be distinguished. */
  authProbeStatuses: number[]
}

/**
 * Attaches listeners that record uncaught page errors, console errors and
 * failed network requests so a test can assert the screen rendered cleanly.
 */
function collectDiagnostics(page: Page): PageDiagnostics {
  const diagnostics: PageDiagnostics = {
    pageErrors: [],
    consoleErrors: [],
    failedRequests: [],
    authProbeStatuses: [],
  }

  page.on('pageerror', (err) => diagnostics.pageErrors.push(err.message))
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') diagnostics.consoleErrors.push(msg.text())
  })
  page.on('response', (res) => {
    if (res.url().includes('/api/v1/auth/')) {
      diagnostics.authProbeStatuses.push(res.status())
    }
  })
  page.on('requestfailed', (req) => {
    const failure = req.failure()
    // Ignore cancelled navigations; real failures still get recorded.
    if (failure && !/ERR_ABORTED/.test(failure.errorText)) {
      diagnostics.failedRequests.push(`${req.url()} :: ${failure.errorText}`)
    }
  })

  return diagnostics
}

/**
 * Waits for React to actually mount, then asserts the main container is non-empty.
 * This deliberately fails when the app renders a blank page.
 */
async function expectRenderedShell(page: Page) {
  await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0, undefined, {
    timeout: 15_000,
  })
  await expect(page.locator('#root')).not.toBeEmpty()
}

/**
 * Fails if any uncaught exception or unexpected console error occurred.
 *
 * Phase 4 note: an anonymous session legitimately receives 401 from
 * /auth/me (and 401 from a deliberately-wrong-password login), and Chromium logs
 * those as console errors. That is CORRECT behaviour - the app must render its
 * logged-out state - so it is filtered here rather than suppressed in
 * application code. Uncaught exceptions, non-auth console errors, and any
 * network-level failure still fail the test.
 */
function expectNoFatalErrors(diagnostics: PageDiagnostics) {
  expect(diagnostics.pageErrors, `Uncaught page errors: ${diagnostics.pageErrors.join(' | ')}`).toEqual([])

  const sawExpected401 = diagnostics.authProbeStatuses.some((s) => s === 401)

  const unexpectedConsole = sawExpected401
    ? diagnostics.consoleErrors.filter((e) => !/status of 401/i.test(e))
    : diagnostics.consoleErrors
  expect(unexpectedConsole, `Console errors: ${unexpectedConsole.join(' | ')}`).toEqual([])

  expect(diagnostics.failedRequests, `Failed requests: ${diagnostics.failedRequests.join(' | ')}`).toEqual([])
}

// ---------------------------------------------------------------------------
// 1. Root route
// ---------------------------------------------------------------------------
test('1. Root route redirects an anonymous visitor to the login page', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)

  // Anonymous mock so /auth/me answers 401 instead of hitting the (absent) backend.
  await mockAuth(page, null)
  await page.goto('/')
  // React Router redirects client-side, so assert the rendered destination
  // rather than relying on a navigation event.
  await expect(page).toHaveURL(/\/login$/)
  await expectRenderedShell(page)
  await expect(page.getByRole('heading', { name: 'PSPL Voucher Portal' })).toBeVisible()
  expectNoFatalErrors(diagnostics)
})

// ---------------------------------------------------------------------------
// 2. Login
// ---------------------------------------------------------------------------
test('2. Login page renders branded content, labels and inputs', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)

  await mockAuth(page, null)
  await page.goto('/login')
  await expectRenderedShell(page)

  await expect(page.getByRole('heading', { name: 'PSPL Voucher Portal' })).toBeVisible()
  await expect(page.getByText('Secure expense management for Prachay Securities')).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  // The Phase 2 demo role selector is permanently removed: it must not exist.
  await expect(page.getByRole('button', { name: 'Login as Employee' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Login as Director' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Login as Accounts' })).toHaveCount(0)
  // Phase 4 replaced the demo banner with an access notice.
  await expect(page.getByText(/Access is restricted to provisioned accounts/i)).toBeVisible()

  ensureScreenshotDir()
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'login.png'), fullPage: true })
  expectNoFatalErrors(diagnostics)
})

// ---------------------------------------------------------------------------
// 3-6. Employee
// ---------------------------------------------------------------------------
test('3. Employee dashboard renders KPIs and recent vouchers', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)
  await mockAuth(page, 'EMPLOYEE')
  await page.goto('/employee')
  await expectRenderedShell(page)

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  for (const kpi of [
    'Total Vouchers',
    'Draft Vouchers',
    'Pending Approval',
    'Approved',
    'Rejected',
    'Total Amount Claimed',
  ]) {
    await expect(page.getByText(kpi, { exact: true })).toBeVisible()
  }

  ensureScreenshotDir()
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'employee-dashboard.png'), fullPage: true })
  expectNoFatalErrors(diagnostics)
})

test('4. Employee voucher list renders the voucher table', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)
  await mockAuth(page, 'EMPLOYEE')
  await page.goto('/employee/vouchers')
  await expectRenderedShell(page)

  await expect(page.getByRole('heading', { name: 'My Vouchers' })).toBeVisible()
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.locator('tbody tr')).not.toHaveCount(0)
  expectNoFatalErrors(diagnostics)
})

test('5. Create Voucher renders its form fields', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)
  await mockAuth(page, 'EMPLOYEE')
  await page.goto('/employee/vouchers/new')
  await expectRenderedShell(page)

  await expect(page.getByRole('heading', { name: 'Create New Voucher' })).toBeVisible()
  await expect(page.getByLabel('Expense Title')).toBeVisible()
  await expect(page.getByLabel('Expense Category')).toBeVisible()
  await expect(page.getByLabel('Expense Description')).toBeVisible()
  await expect(page.getByLabel('Amount (₹)')).toBeVisible()
  expectNoFatalErrors(diagnostics)
})

test('6. Employee voucher detail renders voucher document and draft actions', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)
  await mockAuth(page, 'EMPLOYEE')
  await page.goto(`/employee/vouchers/${VOUCHER_ID}`)
  await expectRenderedShell(page)

  // VoucherDocument renders the shared document layout; the voucher number is
  // the stable identifier across all three roles.
  await expect(page.getByText(MOCK_VOUCHER.voucherNumber).first()).toBeVisible()
  await expect(page.getByText(MOCK_VOUCHER.expenseTitle).first()).toBeVisible()
  expectNoFatalErrors(diagnostics)
})

// ---------------------------------------------------------------------------
// 7-9. Director
// ---------------------------------------------------------------------------
test('7. Director dashboard renders KPIs', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)
  await mockAuth(page, 'DIRECTOR')
  await page.goto('/director')
  await expectRenderedShell(page)

  await expect(page.getByRole('heading', { name: 'Director Dashboard' })).toBeVisible()
  for (const kpi of ['Pending Approval', 'Pending Amount', 'Approved Today', 'Rejected Today']) {
    await expect(page.getByText(kpi, { exact: true })).toBeVisible()
  }
  expectNoFatalErrors(diagnostics)
})

test('8. Director approval queue renders content', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)
  await mockAuth(page, 'DIRECTOR')
  await page.goto('/director/approvals')
  await expectRenderedShell(page)

  await expect(page.getByRole('heading', { name: 'Approval Queue' })).toBeVisible()
  await expect(page.getByPlaceholder('Search number, title, employee...')).toBeVisible()

  ensureScreenshotDir()
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'director-approval-queue.png'), fullPage: true })
  expectNoFatalErrors(diagnostics)
})

test('9. Director voucher review renders document and decision controls', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)
  await mockAuth(page, 'DIRECTOR')
  await page.goto(`/director/vouchers/${VOUCHER_ID}`)
  await expectRenderedShell(page)

  await expect(page.getByRole('heading', { name: 'Review Voucher' })).toBeVisible()
  await expect(page.getByText(MOCK_VOUCHER.voucherNumber).first()).toBeVisible()
  expectNoFatalErrors(diagnostics)
})

// ---------------------------------------------------------------------------
// 10-12. Accounts
// ---------------------------------------------------------------------------
test('10. Accounts dashboard renders KPIs and chart', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)
  await mockAuth(page, 'ACCOUNTS')
  await page.goto('/accounts')
  await expectRenderedShell(page)

  await expect(page.getByRole('heading', { name: 'Accounts Dashboard' })).toBeVisible()
  // Scope KPI labels to <main>: the sidebar contains a link with the same
  // wording ("Approved Vouchers"), which would break strict-mode matching.
  const main = page.locator('#main-content')
  for (const kpi of [
    'Total Vouchers',
    'Pending Approval',
    'Approved Vouchers',
    'Rejected Vouchers',
    'Total Approved Amount',
    'Recent Approved',
  ]) {
    await expect(main.getByText(kpi, { exact: true })).toBeVisible()
  }

  ensureScreenshotDir()
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'accounts-dashboard.png'), fullPage: true })
  expectNoFatalErrors(diagnostics)
})

test('11. Accounts voucher register renders read-only register', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)
  await mockAuth(page, 'ACCOUNTS')
  await page.goto('/accounts/vouchers')
  await expectRenderedShell(page)

  await expect(page.getByRole('heading', { name: 'Voucher Register' })).toBeVisible()
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.locator('tbody tr')).not.toHaveCount(0)

  // Accounts is read-only: no create/edit/approve/reject controls.
  await expect(page.getByRole('button', { name: /^Create Voucher$/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Approve$/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Reject$/ })).toHaveCount(0)
  expectNoFatalErrors(diagnostics)
})

test('12. Accounts voucher detail renders document read-only with print', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)
  await mockAuth(page, 'ACCOUNTS')
  await page.goto(`/accounts/vouchers/${VOUCHER_ID}`)
  await expectRenderedShell(page)

  await expect(page.getByText(MOCK_VOUCHER.voucherNumber).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /^Approve$/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Reject$/ })).toHaveCount(0)
  await expect(page.getByTestId('print-voucher')).toBeVisible()
  expectNoFatalErrors(diagnostics)
})

// ---------------------------------------------------------------------------
// 13. Navigation
// ---------------------------------------------------------------------------
test('13. Sidebar navigation links reach the correct routes', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)
  await mockAuth(page, 'EMPLOYEE')
  await page.goto('/employee')
  await expectRenderedShell(page)

  const nav = page.getByLabel('Navigation').first()
  await nav.getByRole('link', { name: 'Dashboard' }).click()
  await expect(page).toHaveURL(/\/employee$/)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  await page.getByLabel('Navigation').first().getByRole('link', { name: 'My Vouchers' }).click()
  await expect(page).toHaveURL(/\/employee\/vouchers/)
  await expect(page.getByRole('heading', { name: 'My Vouchers' })).toBeVisible()

  await page.getByLabel('Navigation').first().getByRole('link', { name: 'Create Voucher' }).click()
  await expect(page).toHaveURL(/\/employee\/vouchers\/new/)
  await expect(page.getByRole('heading', { name: 'Create New Voucher' })).toBeVisible()
  expectNoFatalErrors(diagnostics)
})

// ---------------------------------------------------------------------------
// 14. Authentication and role-protected routing
// ---------------------------------------------------------------------------
test('14. Real login navigates to the server-reported role home', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)

  // Anonymous before login, then a successful DIRECTOR login.
  await mockAuth(page, null)
  await page.goto('/login')
  await expectRenderedShell(page)

  // Install the DIRECTOR mock for the post-login state.
  await installApiMocks(page, 'DIRECTOR')

  await page.getByLabel('Email').fill('arun.patel@pspl.test')
  await page.getByRole('textbox', { name: 'Password' }).fill('Valid-Password!42')
  await page.getByRole('button', { name: 'Sign In' }).click()

  await expect(page).toHaveURL(/\/director$/)
  await expect(page.getByRole('heading', { name: 'Director Dashboard' })).toBeVisible()
  expectNoFatalErrors(diagnostics)
})

test('14b. Invalid credentials show a generic error and do not navigate', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)

  await mockAuth(page, null)
  await page.goto('/login')
  await expectRenderedShell(page)

  await page.getByLabel('Email').fill('rajesh.kumar@pspl.test')
  await page.getByRole('textbox', { name: 'Password' }).fill('Wrong-Password!1')
  await page.getByRole('button', { name: 'Sign In' }).click()

  await expect(page.getByRole('alert')).toContainText('Invalid email or password.')
  await expect(page).toHaveURL(/\/login$/)
  expectNoFatalErrors(diagnostics)
})

test('14c. Login validates both fields before calling the API', async ({ page }) => {
  await mockAuth(page, null)
  await page.goto('/login')
  await expectRenderedShell(page)

  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByText('Email is required')).toBeVisible()
  await expect(page.getByText('Password is required')).toBeVisible()
})

test('14d. Anonymous access to a protected route redirects to login', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)

  // Anonymous: /auth/me returns 401, so no protected screen may render.
  await mockAuth(page, null)

  // Manually typing the URL must not bypass protection.
  await page.goto('/director')

  // Assert the rendered destination and state rather than a navigation event:
  // React Router redirects client-side, so waitForURL can miss the transition.
  await expect(page.getByRole('heading', { name: 'PSPL Voucher Portal' })).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)

  // The protected Director content must never have been shown.
  await expect(page.getByRole('heading', { name: 'Director Dashboard' })).toHaveCount(0)
  expectNoFatalErrors(diagnostics)
})

test('14e. Wrong-role navigation shows access denied', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)
  // An EMPLOYEE account trying to reach Director-only screens.
  await mockAuth(page, 'EMPLOYEE')

  await page.goto('/director')
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible()
  expectNoFatalErrors(diagnostics)
})

test('14f. Accounts cannot reach mutation-only Employee screens', async ({ page }) => {
  await mockAuth(page, 'ACCOUNTS')

  await page.goto('/employee/vouchers/new')
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible()
})

test('14g. Page refresh rehydrates the session through /auth/me', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)

  await mockAuth(page, 'DIRECTOR')
  await page.goto('/director')
  await expect(page.getByRole('heading', { name: 'Director Dashboard' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Director Dashboard' })).toBeVisible()
  expectNoFatalErrors(diagnostics)
})

test('14h. An expired session returns the UI to login', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)

  // Simulates a session that expired or was revoked server-side: the session
  // endpoint now answers 401 even though the user previously had access.
  await mockAuth(page, null)

  await page.goto('/employee')

  await expect(page.getByRole('heading', { name: 'PSPL Voucher Portal' })).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0)
  expectNoFatalErrors(diagnostics)
})

test('14i. No identity or CSRF token is persisted in browser storage', async ({ page }) => {
  await mockAuth(page, 'EMPLOYEE')
  await page.goto('/employee')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  const storage = await page.evaluate(() => ({
    local: Object.entries({ ...localStorage }),
    session: Object.entries({ ...sessionStorage }),
  }))

  const serialized = JSON.stringify(storage)
  // The Phase 2 demo keys and any JWT/CSRF material must be absent.
  expect(serialized).not.toMatch(/demoRole|demoUserId/)
  expect(serialized).not.toMatch(/csrf/i)
  expect(serialized).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/)
})

test('14j. The user menu offers logout and no role switcher', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)

  await mockAuth(page, 'DIRECTOR')
  await page.goto('/director')
  await expectRenderedShell(page)

  await page.getByRole('button', { name: /User menu for/i }).click()
  await expect(page.getByRole('menu').first()).toBeVisible()

  // The demo role switcher must be gone for good.
  await expect(page.getByText('Switch Role (Demo)')).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: /Logout/i })).toBeVisible()
  expectNoFatalErrors(diagnostics)
})

// ---------------------------------------------------------------------------
// 15. Mobile navigation
// ---------------------------------------------------------------------------
test('15. Mobile navigation drawer opens and closes', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)
  await page.setViewportSize({ width: 375, height: 812 })
  await mockAuth(page, 'EMPLOYEE')
  await page.goto('/employee')
  await expectRenderedShell(page)

  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(page.getByLabel('Mobile navigation')).toBeVisible()

  await page.getByRole('button', { name: 'Close menu' }).click()
  await expect(page.getByLabel('Mobile navigation')).toBeHidden()
  expectNoFatalErrors(diagnostics)
})

// ---------------------------------------------------------------------------
// 16. Buttons, dropdowns and dialogs
// ---------------------------------------------------------------------------
test('16. Notifications, user menu and search dialog operate', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)
  await mockAuth(page, 'EMPLOYEE')
  await page.goto('/employee')
  await expectRenderedShell(page)

  // Notifications popover
  await page.getByRole('button', { name: 'Notifications' }).click()
  await expect(page.getByText(/Notifications/i).first()).toBeVisible()
  await page.keyboard.press('Escape')

  // Global search dialog
  await page.getByRole('button', { name: 'Global search' }).click()
  await expect(page.getByPlaceholder('Search vouchers, employees, departments...')).toBeVisible()
  await page.getByRole('button', { name: 'Close search' }).click()
  await expect(page.getByPlaceholder('Search vouchers, employees, departments...')).toBeHidden()

  // User menu with role switching
  await page.getByRole('button', { name: /User menu for/i }).click()
  await expect(page.getByRole('menu').first()).toBeVisible()
  // Phase 4: the demo role switcher is permanently removed.
  await expect(page.getByText('Switch Role (Demo)')).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: /Logout/i })).toBeVisible()
  expectNoFatalErrors(diagnostics)
})

// ---------------------------------------------------------------------------
// 18. Responsive layout / no horizontal overflow
// ---------------------------------------------------------------------------
const viewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
  { width: 2560, height: 1440 },
]

for (const vp of viewports) {
  test(`18. No unintended horizontal overflow at ${vp.width}px`, async ({ page }) => {
    const diagnostics = collectDiagnostics(page)
    await page.setViewportSize(vp)
    await mockAuth(page, 'EMPLOYEE')
    await page.goto('/employee')
    await expectRenderedShell(page)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    // Allow a 2px tolerance for sub-pixel rounding.
    expect(overflow.scrollWidth, `horizontal overflow at ${vp.width}px`).toBeLessThanOrEqual(
      overflow.clientWidth + 2,
    )
    expectNoFatalErrors(diagnostics)
  })
}

// ---------------------------------------------------------------------------
// 17. Not Found
// ---------------------------------------------------------------------------
test('17. Unknown routes show the Not Found page', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)
  // Anonymous mock so the /auth/me probe on an unknown route answers 401.
  await mockAuth(page, null)
  await page.goto('/this-route-does-not-exist')
  await expectRenderedShell(page)

  await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible()
  expectNoFatalErrors(diagnostics)
})

// ---------------------------------------------------------------------------
// Phase 8: print behaviour
// ---------------------------------------------------------------------------
test('P1. Employee voucher detail print button opens the browser print dialog', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)
  await mockAuth(page, 'EMPLOYEE')
  await page.goto(`/employee/vouchers/${VOUCHER_ID}`)
  await expectRenderedShell(page)

  // Intercept window.print so the real dialog never opens in CI.
  await page.evaluate(() => {
    ;(window as unknown as { __printCalled?: boolean }).__printCalled = false
    window.print = () => {
      ;(window as unknown as { __printCalled?: boolean }).__printCalled = true
    }
  })

  // The shared VoucherDocument exposes a Print action.
  await page.getByTestId('print-voucher').first().click()

  const printCalled = await page.evaluate(
    () => (window as unknown as { __printCalled?: boolean }).__printCalled,
  )
  expect(printCalled).toBe(true)
  expectNoFatalErrors(diagnostics)
})

test('P2. Accounts voucher detail print button opens the browser print dialog', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)
  await mockAuth(page, 'ACCOUNTS')
  await page.goto(`/accounts/vouchers/${VOUCHER_ID}`)
  await expectRenderedShell(page)

  await page.evaluate(() => {
    ;(window as unknown as { __printCalled?: boolean }).__printCalled = false
    window.print = () => {
      ;(window as unknown as { __printCalled?: boolean }).__printCalled = true
    }
  })

  await page.getByTestId('print-voucher').first().click()

  const printCalled = await page.evaluate(
    () => (window as unknown as { __printCalled?: boolean }).__printCalled,
  )
  expect(printCalled).toBe(true)
  expectNoFatalErrors(diagnostics)
})

// ---------------------------------------------------------------------------
// Phase 8: signature rendering on the shared document
// ---------------------------------------------------------------------------
test('P3. Voucher document renders employee and director signature images', async ({ page }) => {
  const diagnostics = collectDiagnostics(page)
  await mockAuth(page, 'ACCOUNTS')
  await page.goto(`/accounts/vouchers/${VOUCHER_ID}`)
  await expectRenderedShell(page)

  // SignatureImage fetches the authorized signature URL and renders <img>.
  await expect(page.getByAltText(/employee signature/i)).toBeVisible()
  await expect(page.getByAltText(/director signature/i)).toBeVisible()
  expectNoFatalErrors(diagnostics)
})
