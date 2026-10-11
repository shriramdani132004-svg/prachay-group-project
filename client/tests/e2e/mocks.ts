import type { Page, Route } from '@playwright/test'

/**
 * Shared Playwright API mocks (Phases 5-9).
 *
 * The harness runs ONLY the Vite dev server (no backend). Every endpoint the
 * real pages call is intercepted here with fixture data matching the real
 * envelope shapes, so the visual/regression tests stay deterministic and
 * self-contained. This is deliberately test-harness-only: application code has
 * no mock/fallback path and always talks to the real backend in production.
 */

export const CSRF_TOKEN = 'e2e-mock-csrf-token'

type Role = 'EMPLOYEE' | 'DIRECTOR' | 'ACCOUNTS'

export const MOCK_USERS: Record<
  Role,
  { id: string; email: string; fullName: string; employeeId: string | null }
> = {
  EMPLOYEE: {
    id: 'emp-001',
    email: 'rajesh.kumar@pspl.test',
    fullName: 'Rajesh Kumar',
    employeeId: 'EMP-001',
  },
  DIRECTOR: {
    id: 'dir-001',
    email: 'arun.patel@pspl.test',
    fullName: 'Arun Patel',
    employeeId: 'DIR-001',
  },
  ACCOUNTS: {
    id: 'acc-001',
    email: 'meera.nair@pspl.test',
    fullName: 'Meera Nair',
    employeeId: 'ACC-001',
  },
}

/** Realistic 1x1 PNG used as a signature image body. */
export const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const DEPARTMENTS = [
  { id: 'dep-ops', code: 'OPS', name: 'Operations' },
  { id: 'dep-fin', code: 'FIN', name: 'Finance' },
  { id: 'dep-tech', code: 'TECH', name: 'Technology' },
]

const CATEGORIES = [
  { id: 'cat-travel', code: 'TRAVEL', name: 'Travel' },
  { id: 'cat-meals', code: 'MEALS', name: 'Meals' },
  { id: 'cat-supplies', code: 'SUPPLIES', name: 'Office Supplies' },
]

/** One APPROVED voucher used by detail/review/register tests. */
export const MOCK_VOUCHER = {
  id: 'vch-001',
  voucherNumber: 'VCH-2026-0001',
  voucherDate: '2026-10-01T00:00:00.000Z',
  expenseDate: '2026-09-28T00:00:00.000Z',
  expenseTitle: 'Client site travel reimbursement',
  expenseDescription: 'Train fare and local travel to the client site.',
  amount: '1500.50',
  currency: 'INR',
  status: 'APPROVED',
  departmentId: 'dep-ops',
  departmentName: 'Operations',
  expenseCategoryId: 'cat-travel',
  expenseCategoryName: 'Travel',
  createdById: 'emp-001',
  createdByName: 'Rajesh Kumar',
  employeeNameSnapshot: 'Rajesh Kumar',
  reviewedById: 'dir-001',
  reviewedByName: 'Arun Patel',
  submittedAt: '2026-09-29T09:00:00.000Z',
  approvedAt: '2026-09-30T10:00:00.000Z',
  rejectedAt: null,
  rejectionReason: null,
  createdAt: '2026-09-28T08:00:00.000Z',
  updatedAt: '2026-09-30T10:00:00.000Z',
  signatures: [
    {
      id: 'sig-emp-001',
      type: 'EMPLOYEE',
      contentType: 'image/png',
      byteSize: 128,
      uploadedAt: '2026-09-29T08:30:00.000Z',
    },
    {
      id: 'sig-dir-001',
      type: 'DIRECTOR',
      contentType: 'image/png',
      byteSize: 128,
      uploadedAt: '2026-09-30T09:45:00.000Z',
    },
  ],
}

const MOCK_EVENTS = [
  {
    id: 'evt-1',
    type: 'CREATED',
    fromStatus: null,
    toStatus: 'DRAFT',
    actorName: 'Rajesh Kumar',
    reason: null,
    createdAt: '2026-09-28T08:00:00.000Z',
  },
  {
    id: 'evt-2',
    type: 'SUBMITTED',
    fromStatus: 'DRAFT',
    toStatus: 'PENDING_APPROVAL',
    actorName: 'Rajesh Kumar',
    reason: null,
    createdAt: '2026-09-29T09:00:00.000Z',
  },
  {
    id: 'evt-3',
    type: 'APPROVED',
    fromStatus: 'PENDING_APPROVAL',
    toStatus: 'APPROVED',
    actorName: 'Arun Patel',
    reason: null,
    createdAt: '2026-09-30T10:00:00.000Z',
  },
]

const MOCK_LIST_ITEMS = [
  MOCK_VOUCHER,
  {
    ...MOCK_VOUCHER,
    id: 'vch-002',
    voucherNumber: 'VCH-2026-0002',
    expenseTitle: 'Team lunch',
    amount: '4200.00',
    status: 'PENDING_APPROVAL',
    approvedAt: null,
    reviewedById: null,
    reviewedByName: null,
    signatures: MOCK_VOUCHER.signatures.slice(0, 1),
  },
]

const STATUS_DISTRIBUTION = [
  { status: 'DRAFT', count: 2, totalAmount: '3200.00' },
  { status: 'SUBMITTED', count: 1, totalAmount: '900.00' },
  { status: 'PENDING_APPROVAL', count: 3, totalAmount: '12500.75' },
  { status: 'APPROVED', count: 8, totalAmount: '48200.25' },
  { status: 'REJECTED', count: 1, totalAmount: '750.00' },
]

const EXPENSE_TREND = {
  granularity: 'month',
  from: '2025-11-01',
  to: '2026-10-10',
  points: [
    { period: '2026-08', count: 3, totalAmount: '12000.00' },
    { period: '2026-09', count: 5, totalAmount: '28500.75' },
    { period: '2026-10', count: 2, totalAmount: '5700.50' },
  ],
}

const CATEGORY_BREAKDOWN = [
  {
    categoryId: 'cat-travel',
    categoryName: 'Travel',
    count: 6,
    totalAmount: '31200.50',
    percentage: '62.50',
  },
  {
    categoryId: 'cat-meals',
    categoryName: 'Meals',
    count: 4,
    totalAmount: '18700.25',
    percentage: '37.50',
  },
]

const ACTIVITY_FEED = [
  {
    id: 'act-1',
    type: 'APPROVED',
    voucherId: 'vch-001',
    voucherNumber: 'VCH-2026-0001',
    actorName: 'Arun Patel',
    createdAt: '2026-09-30T10:00:00.000Z',
    reason: null,
  },
  {
    id: 'act-2',
    type: 'REJECTED',
    voucherId: 'vch-003',
    voucherNumber: 'VCH-2026-0003',
    actorName: 'Arun Patel',
    createdAt: '2026-09-29T15:00:00.000Z',
    reason: 'Amount does not match the attached invoice lines.',
  },
]

const EMPLOYEE_DASHBOARD = {
  totalVouchers: 12,
  draftVouchers: 2,
  pendingApproval: 3,
  approvedVouchers: 6,
  rejectedVouchers: 1,
  totalAmountClaimed: '48200.25',
  recentVouchers: MOCK_LIST_ITEMS,
}

const DIRECTOR_DASHBOARD = {
  pendingApprovalCount: 3,
  approvedToday: 1,
  rejectedToday: 0,
  totalPendingAmount: '12500.75',
  recentActivity: ACTIVITY_FEED,
  recentVouchers: MOCK_LIST_ITEMS,
}

const ACCOUNTS_DASHBOARD = {
  totalVouchers: 15,
  pendingApprovalCount: 3,
  approvedCount: 8,
  rejectedCount: 1,
  totalApprovedExpenseAmount: '48200.25',
  recentApprovedVouchers: [
    {
      id: 'vch-001',
      voucherNumber: 'VCH-2026-0001',
      expenseTitle: 'Client site travel reimbursement',
      amount: '1500.50',
      currency: 'INR',
      approvedAt: '2026-09-30T10:00:00.000Z',
      reviewedByName: 'Arun Patel',
      createdByName: 'Rajesh Kumar',
      departmentName: 'Operations',
    },
  ],
}

function json(data: unknown, status = 200): { status: number; contentType: string; body: string } {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify({
      success: status < 400,
      ...(status < 400
        ? { data, meta: { timestamp: new Date().toISOString(), requestId: 'e2e' } }
        : { error: data, meta: { timestamp: new Date().toISOString(), requestId: 'e2e' } }),
    }),
  }
}

function errorEnvelope(code: string, message: string, status: number) {
  return json({ code, message }, status)
}

/**
 * Installs every API mock the real pages call. Call BEFORE page.goto.
 * `role` controls auth; `null` simulates an anonymous visitor.
 */
export async function installApiMocks(
  page: Page,
  role: Role | null,
): Promise<void> {
  // ---- Auth -------------------------------------------------------------
  await page.route('**/api/v1/auth/me', async (route: Route) => {
    if (!role) {
      return route.fulfill(
        errorEnvelope('UNAUTHORIZED', 'Authentication is required.', 401),
      )
    }
    const user = MOCK_USERS[role]
    return route.fulfill(
      json({
        user: { ...user, role },
        csrfToken: CSRF_TOKEN,
        expiresAt: new Date(Date.now() + 1800000).toISOString(),
      }),
    )
  })

  await page.route('**/api/v1/auth/login', async (route: Route) => {
    if (!role) {
      return route.fulfill(errorEnvelope('UNAUTHORIZED', 'Invalid email or password.', 401))
    }
    const user = MOCK_USERS[role]
    return route.fulfill(
      json({
        user: { ...user, role },
        csrfToken: CSRF_TOKEN,
        expiresAt: new Date(Date.now() + 1800000).toISOString(),
      }),
    )
  })

  // ---- Reference data ---------------------------------------------------
  // The API client unwraps `data` directly to ApiReferenceItem[] (not {items}).
  await page.route('**/api/v1/departments*', (route) => route.fulfill(json(DEPARTMENTS)))
  await page.route('**/api/v1/expense-categories*', (route) =>
    route.fulfill(json(CATEGORIES)),
  )

  // ---- Dashboards -------------------------------------------------------
  await page.route('**/api/v1/vouchers/dashboard', (route) =>
    route.fulfill(json(EMPLOYEE_DASHBOARD)),
  )
  await page.route('**/api/v1/vouchers/director/dashboard', (route) =>
    route.fulfill(json(DIRECTOR_DASHBOARD)),
  )
  await page.route('**/api/v1/vouchers/accounts/dashboard', (route) =>
    route.fulfill(json(ACCOUNTS_DASHBOARD)),
  )

  // ---- Analytics --------------------------------------------------------
  await page.route('**/api/v1/vouchers/analytics/status*', (route) =>
    route.fulfill(json(STATUS_DISTRIBUTION)),
  )
  await page.route('**/api/v1/vouchers/analytics/trends*', (route) =>
    route.fulfill(json(EXPENSE_TREND)),
  )
  await page.route('**/api/v1/vouchers/analytics/categories*', (route) =>
    route.fulfill(json(CATEGORY_BREAKDOWN)),
  )
  await page.route('**/api/v1/vouchers/activity*', (route) => route.fulfill(json(ACTIVITY_FEED)))

  // ---- Signature upload (MUST be registered BEFORE the catch-all below) ---
  await page.route('**/api/v1/signatures/upload', (route) =>
    route.fulfill(
      json({
        id: 'sig-new',
        type: role === 'DIRECTOR' ? 'DIRECTOR' : 'EMPLOYEE',
        contentType: 'image/png',
        byteSize: 128,
        uploadedAt: new Date().toISOString(),
      }),
    ),
  )

  // ---- Signature bytes (SignatureImage does an authenticated fetch) -----
  await page.route('**/api/v1/signatures/*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: PNG_BYTES,
    }),
  )

  // ---- Voucher list (any query string) ----------------------------------
  // Function-based matcher avoids glob ambiguity with query strings. Registered
  // before the catch-all detail route below; Playwright stops at the first match.
  await page.route(
    (url) => {
      const parsed = new URL(url.toString())
      return (
        parsed.pathname === '/api/v1/vouchers' &&
        !parsed.pathname.includes('/dashboard') &&
        !parsed.pathname.includes('/analytics') &&
        !parsed.pathname.includes('/activity')
      )
    },
    (route) =>
      route.fulfill(
        json({ scope: role === 'EMPLOYEE' ? 'own' : 'organization', items: MOCK_LIST_ITEMS }),
      ),
  )

  // ---- Voucher detail + events + actions + nested sub-paths -------------
  // `**` matches nested segments (/vouchers/:id/events, /vouchers/:id/submit, ...)
  await page.route('**/api/v1/vouchers/**', async (route: Route) => {
    const url = new URL(route.request().url())
    const segments = url.pathname.split('/').filter(Boolean)
    // segments: ['api','v1','vouchers', <id>, ...]
    const id = segments[3]
    const action = segments[4]

    if (!id || id === 'dashboard' || id === 'analytics' || id === 'activity') {
      return route.fallback()
    }

    if (action === 'events') {
      return route.fulfill(json(MOCK_EVENTS))
    }

    if (action === 'submit' || action === 'approve' || action === 'reject') {
      return route.fulfill(json({ ...MOCK_VOUCHER, id, status: 'APPROVED' }))
    }

    if (route.request().method() === 'PATCH' || route.request().method() === 'DELETE') {
      return route.fulfill(json({ deleted: true, id }))
    }

    // Plain GET detail
    return route.fulfill(json({ ...MOCK_VOUCHER, id }))
  })
}
