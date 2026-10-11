import './setup-env.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'

/**
 * PHASE 7 - ANALYTICS, ACCOUNTS DASHBOARD, AND SHARED QUERY CONTRACT TESTS.
 *
 * Exercises the REAL Express app + REAL PostgreSQL. Verifies:
 * - GET /api/v1/vouchers/accounts/dashboard (role-gated, real aggregates)
 * - GET /api/v1/vouchers/analytics/status|trends|categories (scope-correct)
 * - GET /api/v1/vouchers/activity (role-scoped activity feed)
 * - Shared list contract: minAmount / maxAmount / voucherDateFrom / voucherDateTo
 *   filters and cross-field range validation.
 *
 * Aggregation correctness is asserted by creating KNOWN fixture rows and
 * comparing the endpoint response against a Prisma query over those same rows.
 */

const TEST_STORAGE_DIR = path.join(
  os.tmpdir(),
  `pspl-analytics-test-${crypto.randomBytes(6).toString('hex')}`,
)
process.env.SIGNATURE_STORAGE_DIR = TEST_STORAGE_DIR

const { createApp } = await import('../../src/app.js')
const { prisma } = await import('../../src/lib/prisma.js')
const fixtures = await import('./fixtures.js')

const app = createApp()
const API = '/api/v1'

interface Session {
  cookie: string
  csrfToken: string
}

const employee = { id: '', email: '', fullName: '', role: 'EMPLOYEE' as const, password: '' }
const director = { id: '', email: '', fullName: '', role: 'DIRECTOR' as const, password: '' }
const accounts = { id: '', email: '', fullName: '', role: 'ACCOUNTS' as const, password: '' }

const createdUserIds: string[] = []
const createdVoucherIds: string[] = []

let departmentId = ''
let expenseCategoryId = ''

async function login(user: { email: string; password: string }): Promise<Session> {
  const response = await request(app)
    .post(`${API}/auth/login`)
    .send({ email: user.email, password: user.password })
    .expect(200)

  return {
    cookie: fixtures.sessionCookieHeader(response.headers['set-cookie']),
    csrfToken: response.body.data.csrfToken as string,
  }
}

async function createKnownVoucher(
  userId: string,
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED',
  amount: string,
  expenseDate: Date,
  reviewedById?: string,
): Promise<{ id: string }> {
  const { allocateVoucherNumber } = await import('../../src/modules/vouchers/voucher-number.service.js')
  const voucherNumber = await allocateVoucherNumber(prisma)
  const now = new Date()

  const voucher = await prisma.voucher.create({
    data: {
      voucherNumber,
      voucherDate: expenseDate,
      expenseDate,
      departmentId,
      expenseTitle: `Analytics fixture ${fixtures.uniqueSuffix()}`,
      expenseCategoryId,
      amount,
      createdById: userId,
      status,
      ...(status === 'APPROVED'
        ? { approvedAt: now, reviewedById: reviewedById ?? userId }
        : {}),
      ...(status === 'REJECTED'
        ? { rejectedAt: now, rejectionReason: 'Analytics fixture rejection' }
        : {}),
      ...(status === 'PENDING_APPROVAL' ? { submittedAt: now } : {}),
    },
    select: { id: true },
  })

  createdVoucherIds.push(voucher.id)
  return voucher
}

beforeAll(async () => {
  employee.password = `Str0ng!${crypto.randomBytes(8).toString('hex')}`
  director.password = `Str0ng!${crypto.randomBytes(8).toString('hex')}`
  accounts.password = `Str0ng!${crypto.randomBytes(8).toString('hex')}`

  const [emp, dir, acc] = await Promise.all([
    fixtures.createFixtureUser('EMPLOYEE', employee.password),
    fixtures.createFixtureUser('DIRECTOR', director.password),
    fixtures.createFixtureUser('ACCOUNTS', accounts.password),
  ])
  Object.assign(employee, emp)
  Object.assign(director, dir)
  Object.assign(accounts, acc)
  createdUserIds.push(emp.id, dir.id, acc.id)

  const dept = await prisma.department.findFirst({ select: { id: true } })
  const cat = await prisma.expenseCategory.findFirst({ select: { id: true } })
  if (!dept || !cat) throw new Error('Reference data missing; run the seed first.')
  departmentId = dept.id
  expenseCategoryId = cat.id

  // Known fixture rows:
  // - employee owns exactly 1 APPROVED voucher of 2500.00 (expenseDate = today).
  // - director owns 1 PENDING_APPROVAL voucher of 750.00 (expenseDate = today).
  // - accounts owns 1 REJECTED voucher of 125.00 (expenseDate = 30 days ago).
  // These values drive every assertion below.
  await createKnownVoucher(employee.id, 'APPROVED', '2500.00', new Date(), director.id)
  await createKnownVoucher(director.id, 'PENDING_APPROVAL', '750.00', new Date())
  await createKnownVoucher(accounts.id, 'REJECTED', '125.00', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
})

afterAll(async () => {
  await fixtures.cleanupFixtures(createdUserIds, createdVoucherIds)
})

describe('GET /api/v1/vouchers/accounts/dashboard', () => {
  it('rejects anonymous access', async () => {
    const response = await request(app).get(`${API}/vouchers/accounts/dashboard`)
    expect(response.status).toBe(401)
    expect(response.body.success).toBe(false)
  })

  it('rejects EMPLOYEE with 403', async () => {
    const session = await login(employee)
    const response = await request(app)
      .get(`${API}/vouchers/accounts/dashboard`)
      .set('Cookie', session.cookie)

    expect(response.status).toBe(403)
    expect(response.body.success).toBe(false)
  })

  it('returns organization-wide aggregates to DIRECTOR', async () => {
    const session = await login(director)
    const response = await request(app)
      .get(`${API}/vouchers/accounts/dashboard`)
      .set('Cookie', session.cookie)
      .expect(200)

    const dashboard = response.body.data
    expect(typeof dashboard.totalVouchers).toBe('number')
    expect(typeof dashboard.pendingApprovalCount).toBe('number')
    expect(typeof dashboard.approvedCount).toBe('number')
    expect(typeof dashboard.rejectedCount).toBe('number')
    expect(dashboard.totalApprovedExpenseAmount).toMatch(/^\d+(\.\d{2})?$/)
    expect(Array.isArray(dashboard.recentApprovedVouchers)).toBe(true)

    // The employee fixture contributed exactly one APPROVED voucher of 2500.00.
    // The dashboard's totalApprovedExpenseAmount must include at least that
    // amount (other tests may have added more, but none subtract).
    expect(Number(dashboard.totalApprovedExpenseAmount)).toBeGreaterThanOrEqual(2500)
    expect(dashboard.approvedCount).toBeGreaterThanOrEqual(1)
  })

  it('returns organization-wide aggregates to ACCOUNTS', async () => {
    const session = await login(accounts)
    const response = await request(app)
      .get(`${API}/vouchers/accounts/dashboard`)
      .set('Cookie', session.cookie)
      .expect(200)

    expect(response.body.data).toHaveProperty('totalVouchers')
    expect(response.body.data).toHaveProperty('recentApprovedVouchers')
  })

  it('agrees with a direct Prisma aggregate over APPROVED rows', async () => {
    const session = await login(director)
    const response = await request(app)
      .get(`${API}/vouchers/accounts/dashboard`)
      .set('Cookie', session.cookie)
      .expect(200)

    const [prismaCount, prismaSum] = await Promise.all([
      prisma.voucher.count({ where: { status: 'APPROVED' } }),
      prisma.voucher.aggregate({ where: { status: 'APPROVED' }, _sum: { amount: true } }),
    ])

    expect(response.body.data.approvedCount).toBe(prismaCount)
    expect(Number(response.body.data.totalApprovedExpenseAmount)).toBe(
      Number(prismaSum._sum.amount?.toFixed(2) ?? 0),
    )
  })
})

describe('GET /api/v1/vouchers/analytics/status', () => {
  it('rejects anonymous access', async () => {
    const response = await request(app).get(`${API}/vouchers/analytics/status`)
    expect(response.status).toBe(401)
  })

  it('returns zero-filled distribution for all five statuses', async () => {
    const session = await login(director)
    const response = await request(app)
      .get(`${API}/vouchers/analytics/status`)
      .set('Cookie', session.cookie)
      .expect(200)

    const items = response.body.data as { status: string; count: number; totalAmount: string }[]
    const statuses = items.map((i) => i.status)
    expect(statuses).toEqual(['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'])
    for (const item of items) {
      expect(typeof item.count).toBe('number')
      expect(item.totalAmount).toMatch(/^\d+(\.\d{2})?$/)
    }
  })

  it('scopes EMPLOYEE to their own vouchers only', async () => {
    const session = await login(employee)
    const response = await request(app)
      .get(`${API}/vouchers/analytics/status`)
      .set('Cookie', session.cookie)
      .expect(200)

    const items = response.body.data as { status: string; count: number; totalAmount: string }[]
    const approved = items.find((i) => i.status === 'APPROVED')
    // The employee fixture created exactly one APPROVED voucher of 2500.00.
    expect(approved?.count).toBe(1)
    expect(Number(approved?.totalAmount)).toBe(2500)
  })

  it('scopes DIRECTOR organization-wide', async () => {
    const session = await login(director)
    const response = await request(app)
      .get(`${API}/vouchers/analytics/status`)
      .set('Cookie', session.cookie)
      .expect(200)

    const items = response.body.data as { status: string; count: number }[]
    const approved = items.find((i) => i.status === 'APPROVED')
    // Organization-wide: must be >= the employee's own 1 approved voucher.
    expect(approved?.count).toBeGreaterThanOrEqual(1)
  })

  it('accepts a status filter', async () => {
    const session = await login(director)
    const response = await request(app)
      .get(`${API}/vouchers/analytics/status?status=APPROVED`)
      .set('Cookie', session.cookie)
      .expect(200)

    const items = response.body.data as { status: string; count: number }[]
    expect(items.every((i) => i.status === 'APPROVED' || i.count === 0)).toBe(true)
  })

  it('rejects an invalid status filter with 400', async () => {
    const session = await login(director)
    const response = await request(app)
      .get(`${API}/vouchers/analytics/status?status=NOT_A_STATUS`)
      .set('Cookie', session.cookie)

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
  })
})

describe('GET /api/v1/vouchers/analytics/trends', () => {
  it('rejects anonymous access', async () => {
    const response = await request(app).get(`${API}/vouchers/analytics/trends`)
    expect(response.status).toBe(401)
  })

  it('returns a monthly-granularity expense trend with a valid window', async () => {
    const session = await login(director)
    const response = await request(app)
      .get(`${API}/vouchers/analytics/trends`)
      .set('Cookie', session.cookie)
      .expect(200)

    const trend = response.body.data
    expect(trend.granularity).toBe('month')
    expect(trend.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(trend.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Array.isArray(trend.points)).toBe(true)

    for (const point of trend.points) {
      expect(point.period).toMatch(/^\d{4}-\d{2}$/)
      expect(typeof point.count).toBe('number')
      expect(point.totalAmount).toMatch(/^\d+(\.\d{2})?$/)
    }

    // Points must be sorted ascending by period.
    const periods = trend.points.map((p: { period: string }) => p.period)
    const sorted = [...periods].sort()
    expect(periods).toEqual(sorted)
  })

  it('supports day granularity', async () => {
    const session = await login(director)
    const response = await request(app)
      .get(`${API}/vouchers/analytics/trends?granularity=day`)
      .set('Cookie', session.cookie)
      .expect(200)

    expect(response.body.data.granularity).toBe('day')
    for (const point of response.body.data.points) {
      expect(point.period).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('rejects an invalid granularity with 400', async () => {
    const session = await login(director)
    const response = await request(app)
      .get(`${API}/vouchers/analytics/trends?granularity=hour`)
      .set('Cookie', session.cookie)

    expect(response.status).toBe(400)
  })

  it('includes the employee fixture voucher in the current month', async () => {
    const session = await login(employee)
    const response = await request(app)
      .get(`${API}/vouchers/analytics/trends`)
      .set('Cookie', session.cookie)
      .expect(200)

    const trend = response.body.data
    const currentMonth = new Date().toISOString().slice(0, 7)
    const currentMonthPoint = trend.points.find((p: { period: string }) => p.period === currentMonth)
    // The employee fixture created one voucher today (2500.00).
    expect(currentMonthPoint).toBeDefined()
    expect(currentMonthPoint.count).toBeGreaterThanOrEqual(1)
    expect(Number(currentMonthPoint.totalAmount)).toBeGreaterThanOrEqual(2500)
  })
})

describe('GET /api/v1/vouchers/analytics/categories', () => {
  it('rejects anonymous access', async () => {
    const response = await request(app).get(`${API}/vouchers/analytics/categories`)
    expect(response.status).toBe(401)
  })

  it('returns a category breakdown with decimal-safe amounts and percentages', async () => {
    const session = await login(director)
    const response = await request(app)
      .get(`${API}/vouchers/analytics/categories`)
      .set('Cookie', session.cookie)
      .expect(200)

    const items = response.body.data as {
      categoryId: string
      categoryName: string
      count: number
      totalAmount: string
      percentage: string
    }[]

    expect(Array.isArray(items)).toBe(true)
    for (const item of items) {
      expect(item.categoryId).toBeTruthy()
      expect(item.categoryName).toBeTruthy()
      expect(typeof item.count).toBe('number')
      expect(item.totalAmount).toMatch(/^\d+(\.\d{2})?$/)
      expect(item.percentage).toMatch(/^\d+(\.\d{2})?$/)
    }

    // Percentages must sum to ~100 (or 0 if no data).
    const totalPercent = items.reduce((acc, i) => acc + Number(i.percentage), 0)
    if (items.length > 0) {
      expect(totalPercent).toBeCloseTo(100, 1)
    }
  })

  it('scopes EMPLOYEE to their own vouchers', async () => {
    const session = await login(employee)
    const response = await request(app)
      .get(`${API}/vouchers/analytics/categories`)
      .set('Cookie', session.cookie)
      .expect(200)

    const items = response.body.data as { totalAmount: string }[]
    const total = items.reduce((acc, i) => acc + Number(i.totalAmount), 0)
    // The employee fixture created exactly one voucher of 2500.00.
    expect(total).toBeGreaterThanOrEqual(2500)
    expect(total).toBeLessThan(2500 * 10) // sanity: not the whole org's data
  })
})

describe('GET /api/v1/vouchers/activity', () => {
  it('rejects anonymous access', async () => {
    const response = await request(app).get(`${API}/vouchers/activity`)
    expect(response.status).toBe(401)
  })

  it('returns organization-wide activity to DIRECTOR', async () => {
    const session = await login(director)
    const response = await request(app)
      .get(`${API}/vouchers/activity`)
      .set('Cookie', session.cookie)
      .expect(200)

    const items = response.body.data as {
      id: string
      type: string
      voucherNumber: string
      createdAt: string
    }[]
    expect(Array.isArray(items)).toBe(true)
    for (const item of items) {
      expect(item.id).toBeTruthy()
      expect(item.type).toBeTruthy()
      expect(item.voucherNumber).toMatch(/^VCH-/)
      expect(item.createdAt).toBeTruthy()
    }
  })

  it('limits the feed size', async () => {
    const session = await login(director)
    const response = await request(app)
      .get(`${API}/vouchers/activity?limit=3`)
      .set('Cookie', session.cookie)
      .expect(200)

    expect((response.body.data as unknown[]).length).toBeLessThanOrEqual(3)
  })

  it('scopes EMPLOYEE to events on their own vouchers', async () => {
    const session = await login(employee)
    const response = await request(app)
      .get(`${API}/vouchers/activity`)
      .set('Cookie', session.cookie)
      .expect(200)

    // The employee fixture created one voucher; that voucher may or may not
    // have events (none were explicitly written), so just validate shape.
    expect(Array.isArray(response.body.data)).toBe(true)
  })
})

describe('shared voucher list contract: amount and voucher-date filters', () => {
  it('filters by minAmount', async () => {
    const session = await login(director)
    const response = await request(app)
      .get(`${API}/vouchers?minAmount=1000`)
      .set('Cookie', session.cookie)
      .expect(200)

    const items = response.body.data.items as { amount: string }[]
    for (const item of items) {
      expect(Number(item.amount)).toBeGreaterThanOrEqual(1000)
    }
  })

  it('filters by maxAmount', async () => {
    const session = await login(director)
    const response = await request(app)
      .get(`${API}/vouchers?maxAmount=500`)
      .set('Cookie', session.cookie)
      .expect(200)

    const items = response.body.data.items as { amount: string }[]
    for (const item of items) {
      expect(Number(item.amount)).toBeLessThanOrEqual(500)
    }
  })

  it('combines minAmount and maxAmount into a closed range', async () => {
    const session = await login(director)
    const response = await request(app)
      .get(`${API}/vouchers?minAmount=100&maxAmount=3000`)
      .set('Cookie', session.cookie)
      .expect(200)

    const items = response.body.data.items as { amount: string }[]
    for (const item of items) {
      const amount = Number(item.amount)
      expect(amount).toBeGreaterThanOrEqual(100)
      expect(amount).toBeLessThanOrEqual(3000)
    }
  })

  it('rejects minAmount > maxAmount with 400', async () => {
    const session = await login(director)
    const response = await request(app)
      .get(`${API}/vouchers?minAmount=5000&maxAmount=100`)
      .set('Cookie', session.cookie)

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
  })

  it('filters by voucherDateFrom and voucherDateTo', async () => {
    const session = await login(director)
    const today = new Date().toISOString().slice(0, 10)
    const response = await request(app)
      .get(`${API}/vouchers?voucherDateFrom=${today}&voucherDateTo=${today}`)
      .set('Cookie', session.cookie)
      .expect(200)

    const items = response.body.data.items as { voucherDate: string }[]
    for (const item of items) {
      expect(item.voucherDate.slice(0, 10)).toBe(today)
    }
  })

  it('rejects voucherDateFrom > voucherDateTo with 400', async () => {
    const session = await login(director)
    const response = await request(app)
      .get(`${API}/vouchers?voucherDateFrom=2026-12-31&voucherDateTo=2026-01-01`)
      .set('Cookie', session.cookie)

    expect(response.status).toBe(400)
  })

  it('rejects an invalid amount filter with 400', async () => {
    const session = await login(director)
    const response = await request(app)
      .get(`${API}/vouchers?minAmount=not-a-number`)
      .set('Cookie', session.cookie)

    expect(response.status).toBe(400)
  })

  it('rejects a negative amount filter with 400', async () => {
    const session = await login(director)
    const response = await request(app)
      .get(`${API}/vouchers?minAmount=-1`)
      .set('Cookie', session.cookie)

    expect(response.status).toBe(400)
  })
})
