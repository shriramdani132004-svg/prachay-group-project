import './setup-env.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'

/**
 * PHASE 5 - EMPLOYEE VOUCHER WORKFLOW INTEGRATION TESTS.
 *
 * Exercises the REAL Express app + REAL PostgreSQL + REAL private signature
 * vault (isolated temp dir). Covers draft create/update/delete, submission
 * lifecycle, the employee dashboard, and list scoping/filter/sort/pagination.
 */

const TEST_STORAGE_DIR = path.join(
  os.tmpdir(),
  `pspl-workflow-test-${crypto.randomBytes(6).toString('hex')}`,
)
process.env.SIGNATURE_STORAGE_DIR = TEST_STORAGE_DIR

const { createApp } = await import('../../src/app.js')
const { prisma } = await import('../../src/lib/prisma.js')
const fixtures = await import('./fixtures.js')

const app = createApp()
const API = '/api/v1'
const CSRF = 'x-csrf-token'

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

interface Session {
  cookie: string
  csrfToken: string
}

const employee = { id: '', email: '', fullName: '', role: 'EMPLOYEE' as const, password: '' }
const otherEmployee = { id: '', email: '', fullName: '', role: 'EMPLOYEE' as const, password: '' }
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

const validDraft = () => ({
  departmentId,
  expenseTitle: 'Client site travel reimbursement',
  expenseCategoryId,
  expenseDate: '2026-10-01',
  amount: 1500.5,
  expenseDescription: 'Train fare and local travel.',
})

async function createDraft(session: Session, body: Record<string, unknown> = validDraft()) {
  const response = await request(app)
    .post(`${API}/vouchers`)
    .set('Cookie', session.cookie)
    .set(CSRF, session.csrfToken)
    .send(body)
    .expect(201)

  createdVoucherIds.push(response.body.data.id as string)
  return response.body.data as {
    id: string
    voucherNumber: string
    status: string
    amount: string
    expenseTitle: string
    createdById: string
    departmentName: string
    expenseCategoryName: string
  }
}

async function uploadPng(session: Session, voucherId: string, fileName = 'signature.png') {
  return request(app)
    .post(`${API}/signatures/upload`)
    .set('Cookie', session.cookie)
    .set(CSRF, session.csrfToken)
    .attach('file', PNG_BYTES, fileName)
    .field('voucherId', voucherId)
}

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`

  Object.assign(employee, await fixtures.createFixtureUser('EMPLOYEE', 'Workflow-Emp-Pass!42'))
  Object.assign(otherEmployee, await fixtures.createFixtureUser('EMPLOYEE', 'Workflow-Emp2-Pass!42'))
  Object.assign(director, await fixtures.createFixtureUser('DIRECTOR', 'Workflow-Dir-Pass!42'))
  Object.assign(accounts, await fixtures.createFixtureUser('ACCOUNTS', 'Workflow-Acc-Pass!42'))
  createdUserIds.push(employee.id, otherEmployee.id, director.id, accounts.id)

  const department = await prisma.department.findFirst({ select: { id: true } })
  const category = await prisma.expenseCategory.findFirst({ select: { id: true } })
  if (!department || !category) throw new Error('Reference data missing; run the seed first.')
  departmentId = department.id
  expenseCategoryId = category.id
})

afterAll(async () => {
  await fixtures.cleanupFixtures(createdUserIds, createdVoucherIds)
  await prisma.$disconnect()
})

// ---------------------------------------------------------------------------
describe('POST /api/v1/vouchers - create draft', () => {
  it('creates an owned DRAFT with a server-generated number and amount as decimal string', async () => {
    const session = await login(employee)
    const voucher = await createDraft(session)

    expect(voucher.status).toBe('DRAFT')
    expect(voucher.createdById).toBe(employee.id)
    expect(voucher.voucherNumber).toMatch(/^VCH-\d{4}-\d{4,}$/)
    // Decimal serialization: never float, always exact string.
    expect(voucher.amount).toBe('1500.50')
    expect(voucher.departmentName).toBeTruthy()
    expect(voucher.expenseCategoryName).toBeTruthy()

    const row = await prisma.voucher.findUniqueOrThrow({
      where: { id: voucher.id },
      select: { status: true, submittedAt: true, reviewedById: true },
    })
    expect(row.status).toBe('DRAFT')
    expect(row.submittedAt).toBeNull()
    expect(row.reviewedById).toBeNull()

    const event = await prisma.voucherEvent.findFirst({
      where: { voucherId: voucher.id, type: 'CREATED' },
    })
    expect(event).not.toBeNull()
  })

  it('allocates strictly increasing voucher numbers across concurrent creates', async () => {
    const session = await login(employee)

    const results = await Promise.all([
      createDraft(session, { ...validDraft(), expenseTitle: 'Concurrent A' }),
      createDraft(session, { ...validDraft(), expenseTitle: 'Concurrent B' }),
      createDraft(session, { ...validDraft(), expenseTitle: 'Concurrent C' }),
    ])

    const numbers = results.map((v) => v.voucherNumber).sort()
    expect(new Set(numbers).size).toBe(3)

    const numericParts = numbers.map((n) => Number(n.split('-')[2] ?? '0'))
    for (let i = 1; i < numericParts.length; i++) {
      expect(numericParts[i]!).toBeGreaterThan(numericParts[i - 1]!)
    }
  })

  it('rejects an unknown department reference with field-level issues', async () => {
    const session = await login(employee)

    const response = await request(app)
      .post(`${API}/vouchers`)
      .set('Cookie', session.cookie)
      .set(CSRF, session.csrfToken)
      .send({ ...validDraft(), departmentId: crypto.randomUUID() })
      .expect(400)

    expect(response.body.error.code).toBe('VALIDATION_FAILED')
  })

  it('rejects amount with more than two decimal places', async () => {
    const session = await login(employee)

    await request(app)
      .post(`${API}/vouchers`)
      .set('Cookie', session.cookie)
      .set(CSRF, session.csrfToken)
      .send({ ...validDraft(), amount: 10.123 })
      .expect(400)
  })

  it('rejects negative and zero amounts', async () => {
    const session = await login(employee)

    for (const amount of [-5, 0]) {
      await request(app)
        .post(`${API}/vouchers`)
        .set('Cookie', session.cookie)
        .set(CSRF, session.csrfToken)
        .send({ ...validDraft(), amount })
        .expect(400)
    }
  })

  it('rejects mass-assignment of owner/status/number/reviewer fields', async () => {
    const session = await login(employee)

    const response = await request(app)
      .post(`${API}/vouchers`)
      .set('Cookie', session.cookie)
      .set(CSRF, session.csrfToken)
      .send({
        ...validDraft(),
        createdById: director.id,
        status: 'APPROVED',
        voucherNumber: 'PV-9999-9999',
        reviewedById: director.id,
      })
      .expect(400)

    expect(response.body.error.code).toBe('VALIDATION_FAILED')
  })

  it('rejects a create without a CSRF token', async () => {
    const session = await login(employee)

    await request(app)
      .post(`${API}/vouchers`)
      .set('Cookie', session.cookie)
      .send(validDraft())
      .expect(403)
  })

  it('rejects a create by a Director or Accounts user', async () => {
    for (const user of [director, accounts]) {
      const session = await login(user)

      await request(app)
        .post(`${API}/vouchers`)
        .set('Cookie', session.cookie)
        .set(CSRF, session.csrfToken)
        .send(validDraft())
        .expect(403)
    }
  })
})

// ---------------------------------------------------------------------------
describe('PATCH/DELETE /api/v1/vouchers/:id - draft editing', () => {
  it('updates editable fields on an owned DRAFT and records an UPDATED event', async () => {
    const session = await login(employee)
    const voucher = await createDraft(session)

    const response = await request(app)
      .patch(`${API}/vouchers/${voucher.id}`)
      .set('Cookie', session.cookie)
      .set(CSRF, session.csrfToken)
      .send({ expenseTitle: 'Updated title', amount: 2500.75 })
      .expect(200)

    expect(response.body.data.expenseTitle).toBe('Updated title')
    expect(response.body.data.amount).toBe('2500.75')

    const event = await prisma.voucherEvent.findFirst({
      where: { voucherId: voucher.id, type: 'UPDATED' },
    })
    expect(event).not.toBeNull()
  })

  it('deletes an owned DRAFT', async () => {
    const session = await login(employee)
    const voucher = await createDraft(session)

    await request(app)
      .delete(`${API}/vouchers/${voucher.id}`)
      .set('Cookie', session.cookie)
      .set(CSRF, session.csrfToken)
      .expect(200)

    const row = await prisma.voucher.findUnique({ where: { id: voucher.id } })
    expect(row).toBeNull()
  })

  it('returns 404 when editing or deleting another employee\'s voucher', async () => {
    const ownerSession = await login(employee)
    const otherSession = await login(otherEmployee)
    const voucher = await createDraft(ownerSession)

    await request(app)
      .patch(`${API}/vouchers/${voucher.id}`)
      .set('Cookie', otherSession.cookie)
      .set(CSRF, otherSession.csrfToken)
      .send({ expenseTitle: 'hijack' })
      .expect(404)

    await request(app)
      .delete(`${API}/vouchers/${voucher.id}`)
      .set('Cookie', otherSession.cookie)
      .set(CSRF, otherSession.csrfToken)
      .expect(404)
  })
})

// ---------------------------------------------------------------------------
describe('POST /api/v1/vouchers/:id/submit - submission lifecycle', () => {
  it('refuses submission without an employee signature (422)', async () => {
    const session = await login(employee)
    const voucher = await createDraft(session)

    const response = await request(app)
      .post(`${API}/vouchers/${voucher.id}/submit`)
      .set('Cookie', session.cookie)
      .set(CSRF, session.csrfToken)
      .expect(422)

    expect(response.body.error.message).toMatch(/employee signature/i)

    const row = await prisma.voucher.findUniqueOrThrow({
      where: { id: voucher.id },
      select: { status: true },
    })
    expect(row.status).toBe('DRAFT')
  })

  it('submits a signed DRAFT: row becomes PENDING_APPROVAL with SUBMITTED + PENDING_APPROVAL events', async () => {
    const session = await login(employee)
    const voucher = await createDraft(session)

    const upload = await uploadPng(session, voucher.id)
    expect(upload.status).toBe(201)
    expect(upload.body.data.type).toBe('EMPLOYEE')

    const response = await request(app)
      .post(`${API}/vouchers/${voucher.id}/submit`)
      .set('Cookie', session.cookie)
      .set(CSRF, session.csrfToken)
      .expect(200)

    expect(response.body.data.status).toBe('PENDING_APPROVAL')
    expect(response.body.data.submittedAt).not.toBeNull()

    const events = await prisma.voucherEvent.findMany({
      where: { voucherId: voucher.id, type: { in: ['SUBMITTED', 'PENDING_APPROVAL'] } },
      orderBy: { createdAt: 'asc' },
    })
    expect(events.map((e) => e.type)).toEqual(['SUBMITTED', 'PENDING_APPROVAL'])

    const row = await prisma.voucher.findUniqueOrThrow({
      where: { id: voucher.id },
      select: { status: true, reviewedById: true, approvedAt: true },
    })
    expect(row.status).toBe('PENDING_APPROVAL')
    expect(row.reviewedById).toBeNull()
    expect(row.approvedAt).toBeNull()
  })

  it('rejects a double submit with 409 and records the transition once', async () => {
    const session = await login(employee)
    const voucher = await createDraft(session)
    await uploadPng(session, voucher.id)

    await request(app)
      .post(`${API}/vouchers/${voucher.id}/submit`)
      .set('Cookie', session.cookie)
      .set(CSRF, session.csrfToken)
      .expect(200)

    const second = await request(app)
      .post(`${API}/vouchers/${voucher.id}/submit`)
      .set('Cookie', session.cookie)
      .set(CSRF, session.csrfToken)
      .expect(409)

    expect(second.body.error.code).toBe('INVALID_STATE_TRANSITION')

    const submittedEvents = await prisma.voucherEvent.count({
      where: { voucherId: voucher.id, type: 'SUBMITTED' },
    })
    expect(submittedEvents).toBe(1)
  })

  it('survives two truly concurrent submits with exactly one success', async () => {
    const session = await login(employee)
    const voucher = await createDraft(session)
    await uploadPng(session, voucher.id)

    const submit = () =>
      request(app)
        .post(`${API}/vouchers/${voucher.id}/submit`)
        .set('Cookie', session.cookie)
        .set(CSRF, session.csrfToken)

    const results = await Promise.allSettled([submit(), submit()])
    const statuses = results.map((r) =>
      r.status === 'fulfilled' ? r.value.status : 0,
    )
    const successes = statuses.filter((s) => s === 200).length
    const conflicts = statuses.filter((s) => s === 409).length

    expect(successes).toBe(1)
    expect(conflicts).toBe(1)

    const submittedEvents = await prisma.voucherEvent.count({
      where: { voucherId: voucher.id, type: 'SUBMITTED' },
    })
    expect(submittedEvents).toBe(1)
  })

  it('rejects submission of another employee\'s DRAFT (404)', async () => {
    const ownerSession = await login(employee)
    const otherSession = await login(otherEmployee)
    const voucher = await createDraft(ownerSession)
    await uploadPng(ownerSession, voucher.id)

    await request(app)
      .post(`${API}/vouchers/${voucher.id}/submit`)
      .set('Cookie', otherSession.cookie)
      .set(CSRF, otherSession.csrfToken)
      .expect(404)
  })

  it('rejects editing or deleting a submitted voucher (409)', async () => {
    const session = await login(employee)
    const voucher = await createDraft(session)
    await uploadPng(session, voucher.id)

    await request(app)
      .post(`${API}/vouchers/${voucher.id}/submit`)
      .set('Cookie', session.cookie)
      .set(CSRF, session.csrfToken)
      .expect(200)

    const patch = await request(app)
      .patch(`${API}/vouchers/${voucher.id}`)
      .set('Cookie', session.cookie)
      .set(CSRF, session.csrfToken)
      .send({ expenseTitle: 'too late' })
      .expect(409)
    expect(patch.body.error.code).toBe('INVALID_STATE_TRANSITION')

    await request(app)
      .delete(`${API}/vouchers/${voucher.id}`)
      .set('Cookie', session.cookie)
      .set(CSRF, session.csrfToken)
      .expect(409)
  })
})

// ---------------------------------------------------------------------------
describe('GET /api/v1/vouchers - list scoping and filtering', () => {
  it('scopes an employee list to own records only', async () => {
    const session = await login(employee)
    const otherSession = await login(otherEmployee)

    const own = await createDraft(session, { ...validDraft(), expenseTitle: 'Own scope probe' })
    const theirs = await createDraft(otherSession, { ...validDraft(), expenseTitle: 'Theirs scope probe' })

    const response = await request(app)
      .get(`${API}/vouchers`)
      .set('Cookie', session.cookie)
      .expect(200)

    expect(response.body.data.scope).toBe('own')
    const ids = (response.body.data.items as { id: string }[]).map((v) => v.id)
    expect(ids).toContain(own.id)
    expect(ids).not.toContain(theirs.id)
  })

  it('gives a Director an organization-wide scope', async () => {
    const employeeSession = await login(employee)
    const directorSession = await login(director)

    const voucher = await createDraft(employeeSession, { ...validDraft(), expenseTitle: 'Org scope probe' })

    const response = await request(app)
      .get(`${API}/vouchers`)
      .set('Cookie', directorSession.cookie)
      .expect(200)

    expect(response.body.data.scope).toBe('organization')
    const ids = (response.body.data.items as { id: string }[]).map((v) => v.id)
    expect(ids).toContain(voucher.id)
  })

  it('filters by status and paginates with a correct meta envelope', async () => {
    const session = await login(employee)

    const response = await request(app)
      .get(`${API}/vouchers?status=DRAFT&page=1&pageSize=2&sortBy=amount&sortOrder=desc`)
      .set('Cookie', session.cookie)
      .expect(200)

    expect(response.body.data.items.length).toBeLessThanOrEqual(2)
    for (const item of response.body.data.items as { status: string }[]) {
      expect(item.status).toBe('DRAFT')
    }

    const pagination = response.body.meta.pagination as {
      page: number
      pageSize: number
      totalItems: number
      totalPages: number
    }
    expect(pagination.page).toBe(1)
    expect(pagination.pageSize).toBe(2)
    expect(pagination.totalItems).toBeGreaterThan(0)
    expect(pagination.totalPages).toBe(Math.ceil(pagination.totalItems / 2))

    const amounts = (response.body.data.items as { amount: string }[]).map((v) => Number(v.amount))
    for (let i = 1; i < amounts.length; i++) {
      expect(amounts[i]!).toBeLessThanOrEqual(amounts[i - 1]!)
    }
  })

  it('searches by voucher number and expense title', async () => {
    const session = await login(employee)
    const probe = await createDraft(session, { ...validDraft(), expenseTitle: 'Zebra-search-probe' })

    const byTitle = await request(app)
      .get(`${API}/vouchers?search=Zebra-search-probe`)
      .set('Cookie', session.cookie)
      .expect(200)

    const ids = (byTitle.body.data.items as { id: string }[]).map((v) => v.id)
    expect(ids).toContain(probe.id)

    const byNumber = await request(app)
      .get(`${API}/vouchers?search=${encodeURIComponent(probe.voucherNumber)}`)
      .set('Cookie', session.cookie)
      .expect(200)

    const numberIds = (byNumber.body.data.items as { id: string }[]).map((v) => v.id)
    expect(numberIds).toContain(probe.id)
  })

  it('rejects an unknown sort field', async () => {
    const session = await login(employee)

    await request(app)
      .get(`${API}/vouchers?sortBy=createdById`)
      .set('Cookie', session.cookie)
      .expect(400)
  })
})

// ---------------------------------------------------------------------------
describe('GET /api/v1/vouchers/dashboard - employee dashboard', () => {
  it('returns own-scope aggregates and recent vouchers', async () => {
    const session = await login(employee)

    const before = await request(app)
      .get(`${API}/vouchers/dashboard`)
      .set('Cookie', session.cookie)
      .expect(200)

    const beforeData = before.body.data

    // Create + submit one more so pending count is provably reactive.
    const voucher = await createDraft(session)
    await uploadPng(session, voucher.id)
    await request(app)
      .post(`${API}/vouchers/${voucher.id}/submit`)
      .set('Cookie', session.cookie)
      .set(CSRF, session.csrfToken)
      .expect(200)

    const after = await request(app)
      .get(`${API}/vouchers/dashboard`)
      .set('Cookie', session.cookie)
      .expect(200)

    const data = after.body.data
    expect(data.totalVouchers).toBe(beforeData.totalVouchers + 1)
    expect(data.pendingApproval).toBe(beforeData.pendingApproval + 1)

    // Server-computed sums are decimal strings, never floats.
    expect(data.totalAmountClaimed).toMatch(/^\d+(\.\d{2})?$/)
    expect(data.recentVouchers.length).toBeGreaterThan(0)
    expect(data.recentVouchers.length).toBeLessThanOrEqual(5)
  })

  it('scopes dashboard aggregates to the authenticated employee only', async () => {
    const otherSession = await login(otherEmployee)
    const ownerSession = await login(employee)

    const probe = await createDraft(ownerSession, {
      ...validDraft(),
      expenseTitle: 'Dashboard scoping probe',
      amount: 7777.77,
    })
    await uploadPng(ownerSession, probe.id)
    await request(app)
      .post(`${API}/vouchers/${probe.id}/submit`)
      .set('Cookie', ownerSession.cookie)
      .set(CSRF, ownerSession.csrfToken)
      .expect(200)

    const other = await request(app)
      .get(`${API}/vouchers/dashboard`)
      .set('Cookie', otherSession.cookie)
      .expect(200)

    // The other employee's numbers must not include the probe voucher.
    const recentIds = (other.body.data.recentVouchers as { id: string }[]).map((v) => v.id)
    expect(recentIds).not.toContain(probe.id)

    const total = other.body.data.totalAmountClaimed as string
    expect(Number(total)).toBeLessThan(7777.77)
  })

  it('refuses the employee dashboard for Director and Accounts', async () => {
    for (const user of [director, accounts]) {
      const session = await login(user)

      await request(app)
        .get(`${API}/vouchers/dashboard`)
        .set('Cookie', session.cookie)
        .expect(403)
    }
  })

  it('requires authentication', async () => {
    await request(app).get(`${API}/vouchers/dashboard`).expect(401)
  })
})

// ---------------------------------------------------------------------------
describe('GET /api/v1/vouchers/:id and /events - detail and timeline', () => {
  it('returns full detail with signatures list and no storage keys', async () => {
    const session = await login(employee)
    const voucher = await createDraft(session)
    await uploadPng(session, voucher.id)

    const response = await request(app)
      .get(`${API}/vouchers/${voucher.id}`)
      .set('Cookie', session.cookie)
      .expect(200)

    expect(response.body.data.id).toBe(voucher.id)
    expect(response.body.data.signatures).toHaveLength(1)
    expect(response.body.data.signatures[0].type).toBe('EMPLOYEE')

    const serialized = JSON.stringify(response.body)
    expect(serialized).not.toContain('storageKey')
    expect(serialized).not.toContain(TEST_STORAGE_DIR)
  })

  it('returns a sanitized event timeline without storage paths', async () => {
    const session = await login(employee)
    const voucher = await createDraft(session)
    await uploadPng(session, voucher.id)
    await request(app)
      .post(`${API}/vouchers/${voucher.id}/submit`)
      .set('Cookie', session.cookie)
      .set(CSRF, session.csrfToken)
      .expect(200)

    const response = await request(app)
      .get(`${API}/vouchers/${voucher.id}/events`)
      .set('Cookie', session.cookie)
      .expect(200)

    const types = (response.body.data as { type: string }[]).map((e) => e.type)
    expect(types).toContain('CREATED')
    expect(types).toContain('SUBMITTED')
    expect(types).toContain('PENDING_APPROVAL')

    const serialized = JSON.stringify(response.body)
    expect(serialized).not.toContain('storageKey')
    expect(serialized).not.toContain(TEST_STORAGE_DIR)
  })
})
