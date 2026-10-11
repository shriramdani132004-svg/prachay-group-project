import './setup-env.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'

/**
 * PHASE 9 - COMPREHENSIVE LIFECYCLE + SECURITY INTEGRATION TESTS.
 *
 * REAL app + REAL PostgreSQL + REAL private vault (isolated temp dir).
 *
 * Complements the per-phase suites (vouchers-workflow, director-workflow,
 * signatures, analytics-accounts) with cross-cutting proofs:
 *  1. End-to-end lifecycle journeys (create → submit → approve / reject) with
 *     every derived surface re-verified against the database.
 *  2. A full IDOR / authorization matrix over the voucher surface.
 *  3. Pagination, search and analytics responses cross-checked against real
 *     Prisma queries (no hardcoded totals).
 *  4. Terminal-state invariants across every mutating endpoint.
 */

const TEST_STORAGE_DIR = path.join(
  os.tmpdir(),
  `pspl-lifecycle-test-${crypto.randomBytes(6).toString('hex')}`,
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

const employeeA = { id: '', email: '', fullName: '', role: 'EMPLOYEE' as const, password: '' }
const employeeB = { id: '', email: '', fullName: '', role: 'EMPLOYEE' as const, password: '' }
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

async function createDraft(
  session: Session,
  title: string,
  amount: number | string = 1500,
): Promise<{ id: string; status: string; amount: string }> {
  const response = await request(app)
    .post(`${API}/vouchers`)
    .set('Cookie', session.cookie)
    .set(CSRF, session.csrfToken)
    .send({
      departmentId,
      expenseTitle: title,
      expenseCategoryId,
      expenseDate: '2026-10-03',
      amount,
    })
    .expect(201)

  createdVoucherIds.push(response.body.data.id as string)
  return response.body.data as { id: string; status: string; amount: string }
}

async function sign(session: Session, voucherId: string, type: 'employee' | 'director') {
  const response = await request(app)
    .post(`${API}/signatures/upload`)
    .set('Cookie', session.cookie)
    .set(CSRF, session.csrfToken)
    .attach('file', PNG_BYTES, `${type}-signature.png`)
    .field('voucherId', voucherId)
    .expect(201)
  return response.body.data as { id: string; type: string }
}

/** Drives a voucher all the way to PENDING_APPROVAL with both signatures. */
async function createPending(session: Session, title: string, amount: number | string = 1500) {
  const voucher = await createDraft(session, title, amount)
  await sign(session, voucher.id, 'employee')
  await request(app)
    .post(`${API}/vouchers/${voucher.id}/submit`)
    .set('Cookie', session.cookie)
    .set(CSRF, session.csrfToken)
    .expect(200)
  const directorSession = await login(director)
  await sign(directorSession, voucher.id, 'director')
  return voucher
}

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`

  Object.assign(employeeA, await fixtures.createFixtureUser('EMPLOYEE', 'Lifecycle-A!42x'))
  Object.assign(employeeB, await fixtures.createFixtureUser('EMPLOYEE', 'Lifecycle-B!42x'))
  Object.assign(director, await fixtures.createFixtureUser('DIRECTOR', 'Lifecycle-Dir!42x'))
  Object.assign(accounts, await fixtures.createFixtureUser('ACCOUNTS', 'Lifecycle-Acc!42x'))
  createdUserIds.push(employeeA.id, employeeB.id, director.id, accounts.id)

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
// 1. END-TO-END LIFECYCLE JOURNEYS
// ---------------------------------------------------------------------------
describe('Lifecycle journey: create → submit → approve', () => {
  it('drives a voucher through the full happy path and every derived surface matches the DB', async () => {
    const emp = await login(employeeA)
    const dir = await login(director)

    // --- Create + sign + submit ------------------------------------------
    const voucher = await createDraft(emp, 'Lifecycle happy path', 4321.55)
    await sign(emp, voucher.id, 'employee')

    const submitted = await request(app)
      .post(`${API}/vouchers/${voucher.id}/submit`)
      .set('Cookie', emp.cookie)
      .set(CSRF, emp.csrfToken)
      .expect(200)
    expect(submitted.body.data.status).toBe('PENDING_APPROVAL')

    // --- Director signs + approves ----------------------------------------
    await sign(dir, voucher.id, 'director')
    const approved = await request(app)
      .post(`${API}/vouchers/${voucher.id}/approve`)
      .set('Cookie', dir.cookie)
      .set(CSRF, dir.csrfToken)
      .expect(200)
    expect(approved.body.data.status).toBe('APPROVED')
    expect(approved.body.data.reviewedByName).toBe(director.fullName)

    // --- Every derived surface is re-read from the database ----------------
    const row = await prisma.voucher.findUniqueOrThrow({
      where: { id: voucher.id },
      select: {
        status: true,
        submittedAt: true,
        approvedAt: true,
        rejectedAt: true,
        rejectionReason: true,
        reviewedById: true,
        createdById: true,
      },
    })
    expect(row.status).toBe('APPROVED')
    expect(row.submittedAt).toBeInstanceOf(Date)
    expect(row.approvedAt).toBeInstanceOf(Date)
    expect(row.rejectedAt).toBeNull()
    expect(row.rejectionReason).toBeNull()
    expect(row.reviewedById).toBe(director.id)
    expect(row.createdById).toBe(employeeA.id)

    // Event timeline: CREATED, SUBMITTED, PENDING_APPROVAL, APPROVED — in order.
    const events = await prisma.voucherEvent.findMany({
      where: { voucherId: voucher.id },
      orderBy: { createdAt: 'asc' },
      select: { type: true, fromStatus: true, toStatus: true, actorId: true },
    })
    expect(events.map((e) => e.type)).toEqual([
      'CREATED',
      'SUBMITTED',
      'PENDING_APPROVAL',
      'APPROVED',
    ])
    expect(events.at(-1)?.actorId).toBe(director.id)

    // Both signatures exist; no raw storage keys leak from the API.
    const detail = await request(app)
      .get(`${API}/vouchers/${voucher.id}`)
      .set('Cookie', emp.cookie)
      .expect(200)
    expect(detail.body.data.status).toBe('APPROVED')
    const sigTypes = (detail.body.data.signatures as { type: string }[]).map((s) => s.type)
    expect(sigTypes).toContain('EMPLOYEE')
    expect(sigTypes).toContain('DIRECTOR')
    expect(JSON.stringify(detail.body)).not.toMatch(/storageKey|storagePath|SIGNATURE_STORAGE/)

    // API event timeline mirrors the DB rows (sanitized shape).
    const apiEvents = await request(app)
      .get(`${API}/vouchers/${voucher.id}/events`)
      .set('Cookie', emp.cookie)
      .expect(200)
    expect(apiEvents.body.data).toHaveLength(4)
    expect(JSON.stringify(apiEvents.body)).not.toMatch(/storageKey|storagePath/)

    // Employee dashboard aggregates reflect the approval.
    const dash = await request(app)
      .get(`${API}/vouchers/dashboard`)
      .set('Cookie', emp.cookie)
      .expect(200)
    const dashRow = dash.body.data as {
      approvedVouchers: number
      totalAmountClaimed: string
      recentVouchers: { id: string }[]
    }
    const dbAgg = await prisma.voucher.aggregate({
      where: { createdById: employeeA.id },
      _count: { _all: true },
      _sum: { amount: true },
    })
    const dbApproved = await prisma.voucher.count({
      where: { createdById: employeeA.id, status: 'APPROVED' },
    })
    expect(dashRow.approvedVouchers).toBe(dbApproved)
    expect(Number(dashRow.totalAmountClaimed)).toBeCloseTo(Number(dbAgg._sum.amount ?? 0), 2)
    expect(dashRow.recentVouchers.some((v) => v.id === voucher.id)).toBe(true)
  })
})

describe('Lifecycle journey: create → submit → reject', () => {
  it('records the rejection with its reason and leaves the voucher read-only', async () => {
    const emp = await login(employeeA)
    const dir = await login(director)

    const voucher = await createPending(emp, 'Lifecycle reject path', 999.99)

    const rejected = await request(app)
      .post(`${API}/vouchers/${voucher.id}/reject`)
      .set('Cookie', dir.cookie)
      .set(CSRF, dir.csrfToken)
      .send({ reason: '  Amount does not match the attached invoice lines.  ' })
      .expect(200)
    expect(rejected.body.data.status).toBe('REJECTED')

    const row = await prisma.voucher.findUniqueOrThrow({
      where: { id: voucher.id },
      select: { status: true, rejectedAt: true, rejectionReason: true, reviewedById: true },
    })
    expect(row.status).toBe('REJECTED')
    expect(row.rejectedAt).toBeInstanceOf(Date)
    expect(row.rejectionReason).toBe('Amount does not match the attached invoice lines.')
    expect(row.reviewedById).toBe(director.id)

    const events = await prisma.voucherEvent.findMany({
      where: { voucherId: voucher.id },
      orderBy: { createdAt: 'asc' },
      select: { type: true },
    })
    expect(events.map((e) => e.type)).toEqual([
      'CREATED',
      'SUBMITTED',
      'PENDING_APPROVAL',
      'REJECTED',
    ])

    // Terminal + read-only for the owner on every mutating endpoint.
    await request(app)
      .patch(`${API}/vouchers/${voucher.id}`)
      .set('Cookie', emp.cookie)
      .set(CSRF, emp.csrfToken)
      .send({ expenseTitle: 'post-rejection edit' })
      .expect(409)
    await request(app)
      .delete(`${API}/vouchers/${voucher.id}`)
      .set('Cookie', emp.cookie)
      .set(CSRF, emp.csrfToken)
      .expect(409)
    await request(app)
      .post(`${API}/vouchers/${voucher.id}/submit`)
      .set('Cookie', emp.cookie)
      .set(CSRF, emp.csrfToken)
      .expect(409)
    const unchanged = await prisma.voucher.findUniqueOrThrow({
      where: { id: voucher.id },
      select: { status: true, rejectionReason: true },
    })
    expect(unchanged.status).toBe('REJECTED')
    expect(unchanged.rejectionReason).toBe('Amount does not match the attached invoice lines.')
  })
})

// ---------------------------------------------------------------------------
// 2. IDOR / AUTHORIZATION MATRIX
// ---------------------------------------------------------------------------
describe('IDOR and authorization matrix', () => {
  let targetId = ''

  beforeAll(async () => {
    const emp = await login(employeeA)
    targetId = (await createPending(emp, 'IDOR matrix target', 7777.77)).id
  })

  it("hides another employee's voucher behind 404 on every read and write", async () => {
    const other = await login(employeeB)

    await request(app).get(`${API}/vouchers/${targetId}`).set('Cookie', other.cookie).expect(404)
    await request(app).get(`${API}/vouchers/${targetId}/events`).set('Cookie', other.cookie).expect(404)
    await request(app)
      .patch(`${API}/vouchers/${targetId}`)
      .set('Cookie', other.cookie)
      .set(CSRF, other.csrfToken)
      .send({ expenseTitle: 'tampered' })
      .expect(404)
    await request(app)
      .delete(`${API}/vouchers/${targetId}`)
      .set('Cookie', other.cookie)
      .set(CSRF, other.csrfToken)
      .expect(404)
    await request(app)
      .post(`${API}/vouchers/${targetId}/submit`)
      .set('Cookie', other.cookie)
      .set(CSRF, other.csrfToken)
      .expect(404)
    await request(app)
      .post(`${API}/signatures/upload`)
      .set('Cookie', other.cookie)
      .set(CSRF, other.csrfToken)
      .attach('file', PNG_BYTES, 'sig.png')
      .field('voucherId', targetId)
      .expect(404)

    const row = await prisma.voucher.findUniqueOrThrow({
      where: { id: targetId },
      select: { expenseTitle: true, status: true },
    })
    expect(row.expenseTitle).toBe('IDOR matrix target')
    expect(row.status).toBe('PENDING_APPROVAL')
  })

  it('allows Director and Accounts to read but never to mutate another employee’s voucher', async () => {
    const dir = await login(director)
    const acc = await login(accounts)

    for (const session of [dir, acc]) {
      await request(app).get(`${API}/vouchers/${targetId}`).set('Cookie', session.cookie).expect(200)
      await request(app)
        .get(`${API}/vouchers/${targetId}/events`)
        .set('Cookie', session.cookie)
        .expect(200)
      await request(app)
        .patch(`${API}/vouchers/${targetId}`)
        .set('Cookie', session.cookie)
        .set(CSRF, session.csrfToken)
        .send({ expenseTitle: 'tampered' })
        .expect(404)
      await request(app)
        .delete(`${API}/vouchers/${targetId}`)
        .set('Cookie', session.cookie)
        .set(CSRF, session.csrfToken)
        .expect(404)
    }
  })

  it('forbids Employee and Accounts from approve/reject while allowing the Director', async () => {
    const emp = await login(employeeA)
    const acc = await login(accounts)
    const dir = await login(director)

    for (const session of [emp, acc]) {
      await request(app)
        .post(`${API}/vouchers/${targetId}/approve`)
        .set('Cookie', session.cookie)
        .set(CSRF, session.csrfToken)
        .expect(403)
      await request(app)
        .post(`${API}/vouchers/${targetId}/reject`)
        .set('Cookie', session.cookie)
        .set(CSRF, session.csrfToken)
        .send({ reason: 'not allowed' })
        .expect(403)
    }

    // The Director decision itself still succeeds (voucher is PENDING_APPROVAL
    // and already carries a Director signature from createPending).
    await request(app)
      .post(`${API}/vouchers/${targetId}/approve`)
      .set('Cookie', dir.cookie)
      .set(CSRF, dir.csrfToken)
      .expect(200)
  })

  it('gates organization-wide endpoints: Employee forbidden, Director/Accounts allowed', async () => {
    const emp = await login(employeeA)
    const dir = await login(director)
    const acc = await login(accounts)

    // Employee cannot read organization aggregates.
    await request(app).get(`${API}/vouchers/accounts/dashboard`).set('Cookie', emp.cookie).expect(403)
    await request(app).get(`${API}/vouchers/activity?limit=5`).set('Cookie', emp.cookie).expect(200) // own-scope activity is fine
    // Director and Accounts can.
    await request(app).get(`${API}/vouchers/accounts/dashboard`).set('Cookie', dir.cookie).expect(200)
    await request(app).get(`${API}/vouchers/accounts/dashboard`).set('Cookie', acc.cookie).expect(200)
  })

  it('keeps every employee list scoped to own records only', async () => {
    const empA = await login(employeeA)
    const empB = await login(employeeB)

    // employeeB owns nothing in this suite's target set; their list must not
    // contain employeeA's IDOR-target voucher.
    const listB = await request(app)
      .get(`${API}/vouchers?pageSize=100`)
      .set('Cookie', empB.cookie)
      .expect(200)
    const itemsB = listB.body.data.items as { id: string }[]
    expect(itemsB.some((v) => v.id === targetId)).toBe(false)
    expect(listB.body.data.scope).toBe('own')

    // And the DB agrees: every listed id belongs to employeeB.
    const ownedByB = await prisma.voucher.findMany({
      where: { createdById: employeeB.id },
      select: { id: true },
    })
    expect(new Set(itemsB.map((v) => v.id))).toEqual(new Set(ownedByB.map((v) => v.id)))
    void empA
  })
})

// ---------------------------------------------------------------------------
// 3. TERMINAL-STATE INVARIANTS
// ---------------------------------------------------------------------------
describe('Terminal states hold across every mutating endpoint', () => {
  let approvedId = ''
  let rejectedId = ''

  beforeAll(async () => {
    const emp = await login(employeeA)
    const dir = await login(director)

    approvedId = (await createPending(emp, 'Terminal approved voucher', 3333.33)).id
    await request(app)
      .post(`${API}/vouchers/${approvedId}/approve`)
      .set('Cookie', dir.cookie)
      .set(CSRF, dir.csrfToken)
      .expect(200)

    rejectedId = (await createPending(emp, 'Terminal rejected voucher', 2222.22)).id
    await request(app)
      .post(`${API}/vouchers/${rejectedId}/reject`)
      .set('Cookie', dir.cookie)
      .set(CSRF, dir.csrfToken)
      .send({ reason: 'Policy violation' })
      .expect(200)
  })

  it('rejects re-approve, re-reject, submit, edit and delete on an APPROVED voucher', async () => {
    const emp = await login(employeeA)
    const dir = await login(director)

    await request(app)
      .post(`${API}/vouchers/${approvedId}/approve`)
      .set('Cookie', dir.cookie)
      .set(CSRF, dir.csrfToken)
      .expect(409)
    await request(app)
      .post(`${API}/vouchers/${approvedId}/reject`)
      .set('Cookie', dir.cookie)
      .set(CSRF, dir.csrfToken)
      .send({ reason: 'Decision reversed after approval' })
      .expect(409)
    await request(app)
      .post(`${API}/vouchers/${approvedId}/submit`)
      .set('Cookie', emp.cookie)
      .set(CSRF, emp.csrfToken)
      .expect(409)
    await request(app)
      .patch(`${API}/vouchers/${approvedId}`)
      .set('Cookie', emp.cookie)
      .set(CSRF, emp.csrfToken)
      .send({ expenseTitle: 'late edit' })
      .expect(409)
    await request(app)
      .delete(`${API}/vouchers/${approvedId}`)
      .set('Cookie', emp.cookie)
      .set(CSRF, emp.csrfToken)
      .expect(409)

    // Signature replacement on a decided voucher is also refused.
    await request(app)
      .post(`${API}/signatures/upload`)
      .set('Cookie', emp.cookie)
      .set(CSRF, emp.csrfToken)
      .attach('file', PNG_BYTES, 'sig.png')
      .field('voucherId', approvedId)
      .expect(409)
  })

  it('rejects every re-decision on a REJECTED voucher', async () => {
    const dir = await login(director)
    const emp = await login(employeeA)

    await request(app)
      .post(`${API}/vouchers/${rejectedId}/approve`)
      .set('Cookie', dir.cookie)
      .set(CSRF, dir.csrfToken)
      .expect(409)
    await request(app)
      .post(`${API}/vouchers/${rejectedId}/reject`)
      .set('Cookie', dir.cookie)
      .set(CSRF, dir.csrfToken)
      .send({ reason: 'Attempting a second decision' })
      .expect(409)
    await request(app)
      .patch(`${API}/vouchers/${rejectedId}`)
      .set('Cookie', emp.cookie)
      .set(CSRF, emp.csrfToken)
      .send({ amount: 1 })
      .expect(409)
    await request(app)
      .delete(`${API}/vouchers/${rejectedId}`)
      .set('Cookie', emp.cookie)
      .set(CSRF, emp.csrfToken)
      .expect(409)
  })
})

// ---------------------------------------------------------------------------
// 4. PAGINATION / SEARCH / ANALYTICS VS DATABASE FACTS
// ---------------------------------------------------------------------------
describe('List pagination and search match database facts', () => {
  const ownedIds: string[] = []

  beforeAll(async () => {
    const emp = await login(employeeA)
    for (const title of [
      'Alpha offsite travel',
      'Beta client dinner',
      'Gamma office supplies',
      'Delta local commute',
      'Epsilon conference pass',
    ]) {
      const voucher = await createDraft(emp, title, 1000 + ownedIds.length * 100)
      ownedIds.push(voucher.id)
    }
  })

  it('paginates with meta that exactly matches a DB count and page window', async () => {
    const emp = await login(employeeA)
    const dbTotal = await prisma.voucher.count({ where: { createdById: employeeA.id } })
    expect(dbTotal).toBeGreaterThanOrEqual(ownedIds.length)

    const first = await request(app)
      .get(`${API}/vouchers?page=1&pageSize=2&sortBy=createdAt&sortOrder=asc`)
      .set('Cookie', emp.cookie)
      .expect(200)
    const meta = first.body.meta.pagination as {
      page: number
      pageSize: number
      totalItems: number
      totalPages: number
      hasNextPage: boolean
      hasPreviousPage: boolean
    }
    expect(meta.totalItems).toBe(dbTotal)
    expect(meta.totalPages).toBe(Math.ceil(dbTotal / 2))
    expect(meta.hasNextPage).toBe(dbTotal > 2)
    expect(meta.hasPreviousPage).toBe(false)
    expect((first.body.data.items as unknown[]).length).toBeLessThanOrEqual(2)

    // Page windows are disjoint and cover the full set.
    const pageIds: string[] = []
    for (let page = 1; page <= meta.totalPages; page += 1) {
      const response = await request(app)
        .get(`${API}/vouchers?page=${page}&pageSize=2&sortBy=createdAt&sortOrder=asc`)
        .set('Cookie', emp.cookie)
        .expect(200)
      pageIds.push(...(response.body.data.items as { id: string }[]).map((v) => v.id))
    }
    expect(new Set(pageIds).size).toBe(dbTotal)
    expect(pageIds).toEqual(
      expect.arrayContaining(ownedIds),
    )
  })

  it('searches by title and returns exactly the DB-matching subset', async () => {
    const emp = await login(employeeA)
    const needle = 'offsite travel'
    const response = await request(app)
      .get(`${API}/vouchers?search=${encodeURIComponent(needle)}&pageSize=100`)
      .set('Cookie', emp.cookie)
      .expect(200)
    const listed = response.body.data.items as { id: string; expenseTitle: string }[]
    const dbMatches = await prisma.voucher.findMany({
      where: {
        createdById: employeeA.id,
        expenseTitle: { contains: needle, mode: 'insensitive' },
      },
      select: { id: true },
    })
    expect(listed).toHaveLength(dbMatches.length)
    expect(listed.length).toBeGreaterThan(0)
    expect(new Set(listed.map((v) => v.id))).toEqual(new Set(dbMatches.map((v) => v.id)))
  })

  it('rejects inverted filter ranges with field-level 400s', async () => {
    const emp = await login(employeeA)
    for (const qs of [
      'minAmount=500&maxAmount=100',
      'dateFrom=2026-10-10&dateTo=2026-10-01',
      'voucherDateFrom=2026-10-10&voucherDateTo=2026-10-01',
      'status=NOT_A_STATUS',
      'page=0',
      'pageSize=9999',
    ]) {
      const response = await request(app)
        .get(`${API}/vouchers?${qs}`)
        .set('Cookie', emp.cookie)
        .expect(400)
      expect(response.body.error.code).toBe('VALIDATION_FAILED')
    }
  })

  it('filters by amount range and matches a DB-aggregated total', async () => {
    const emp = await login(employeeA)
    const response = await request(app)
      .get(`${API}/vouchers?minAmount=1200&maxAmount=1400&pageSize=100`)
      .set('Cookie', emp.cookie)
      .expect(200)
    const items = response.body.data.items as { amount: string }[]
    for (const item of items) {
      expect(Number(item.amount)).toBeGreaterThanOrEqual(1200)
      expect(Number(item.amount)).toBeLessThanOrEqual(1400)
    }
    const dbCount = await prisma.voucher.count({
      where: {
        createdById: employeeA.id,
        amount: { gte: 1200, lte: 1400 },
      },
    })
    expect(items).toHaveLength(dbCount)
  })
})

describe('Analytics aggregates match database facts', () => {
  it('status distribution equals per-status Prisma counts and amount sums', async () => {
    const dir = await login(director)
    const response = await request(app)
      .get(`${API}/vouchers/analytics/status`)
      .set('Cookie', dir.cookie)
      .expect(200)
    const rows = response.body.data as { status: string; count: number; totalAmount: string }[]

    const statuses = ['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as const
    expect(rows.map((r) => r.status).sort()).toEqual([...statuses].sort())

    for (const status of statuses) {
      const agg = await prisma.voucher.aggregate({
        where: { status },
        _count: { _all: true },
        _sum: { amount: true },
      })
      const row = rows.find((r) => r.status === status)!
      expect(row.count).toBe(agg._count._all)
      expect(Number(row.totalAmount)).toBeCloseTo(Number(agg._sum.amount ?? 0), 2)
    }
  })

  it('employee-scoped analytics never include another employee’s vouchers', async () => {
    const emp = await login(employeeB)
    const response = await request(app)
      .get(`${API}/vouchers/analytics/status`)
      .set('Cookie', emp.cookie)
      .expect(200)
    const rows = response.body.data as { status: string; count: number }[]
    const total = rows.reduce((sum, r) => sum + r.count, 0)
    const dbCount = await prisma.voucher.count({ where: { createdById: employeeB.id } })
    expect(total).toBe(dbCount)
  })

  it('trend and category endpoints return well-formed, scoped aggregates', async () => {
    const dir = await login(director)

    const trend = await request(app)
      .get(`${API}/vouchers/analytics/trends?granularity=month`)
      .set('Cookie', dir.cookie)
      .expect(200)
    expect(trend.body.data.granularity).toBe('month')
    expect(Array.isArray(trend.body.data.points)).toBe(true)
    for (const point of trend.body.data.points as { period: string; count: number; totalAmount: string }[]) {
      expect(point.period).toMatch(/^\d{4}-\d{2}$/)
      expect(point.count).toBeGreaterThanOrEqual(0)
      expect(Number(point.totalAmount)).toBeGreaterThanOrEqual(0)
    }

    const categories = await request(app)
      .get(`${API}/vouchers/analytics/categories`)
      .set('Cookie', dir.cookie)
      .expect(200)
    const catRows = categories.body.data as { categoryId: string; count: number; totalAmount: string; percentage: string }[]
    const sumCount = catRows.reduce((s, r) => s + r.count, 0)
    const dbCount = await prisma.voucher.count()
    expect(sumCount).toBeLessThanOrEqual(dbCount)
    const pctSum = catRows.reduce((s, r) => s + Number(r.percentage), 0)
    expect(pctSum).toBeCloseTo(catRows.length > 0 ? 100 : 0, 1)
  })

  it('activity feed is scoped and ordered newest-first', async () => {
    const emp = await login(employeeA)
    const response = await request(app)
      .get(`${API}/vouchers/activity?limit=10`)
      .set('Cookie', emp.cookie)
      .expect(200)
    const items = response.body.data as { createdAt: string; voucherId: string }[]
    expect(items.length).toBeLessThanOrEqual(10)
    const timestamps = items.map((i) => new Date(i.createdAt).getTime())
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a))
    // Every activity row belongs to a voucher the employee can actually read.
    for (const item of items) {
      const voucher = await prisma.voucher.findUnique({
        where: { id: item.voucherId },
        select: { createdById: true },
      })
      expect(voucher?.createdById).toBe(employeeA.id)
    }
  })
})
