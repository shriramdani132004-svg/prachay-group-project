import './setup-env.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'

/**
 * PHASE 6 - DIRECTOR APPROVAL COMMAND CENTER INTEGRATION TESTS.
 *
 * REAL app + REAL PostgreSQL + REAL private vault (isolated temp dir).
 * Covers the director dashboard, approve/reject workflows, concurrency,
 * terminal states, and rejection-reason validation.
 */

const TEST_STORAGE_DIR = path.join(
  os.tmpdir(),
  `pspl-director-test-${crypto.randomBytes(6).toString('hex')}`,
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

async function createDraft(session: Session, title = 'Director workflow voucher', amount: number | string = 2000) {
  const response = await request(app)
    .post(`${API}/vouchers`)
    .set('Cookie', session.cookie)
    .set(CSRF, session.csrfToken)
    .send({
      departmentId,
      expenseTitle: title,
      expenseCategoryId,
      expenseDate: '2026-10-02',
      amount,
    })
    .expect(201)

  createdVoucherIds.push(response.body.data.id as string)
  return response.body.data as { id: string; status: string; amount: string }
}

async function uploadPng(session: Session, voucherId: string, type: 'employee' | 'director') {
  return request(app)
    .post(`${API}/signatures/upload`)
    .set('Cookie', session.cookie)
    .set(CSRF, session.csrfToken)
    .attach('file', PNG_BYTES, `${type}-signature.png`)
    .field('voucherId', voucherId)
}

/** Creates a voucher owned by employee that sits in PENDING_APPROVAL with both signatures. */
async function createPendingVoucher(
  title = 'Pending voucher',
  amount: number | string = 2000,
) {
  const employeeSession = await login(employee)
  const directorSession = await login(director)

  const voucher = await createDraft(employeeSession, title, amount)
  // Employee signs while DRAFT, then submits.
  await uploadPng(employeeSession, voucher.id, 'employee')
  await request(app)
    .post(`${API}/vouchers/${voucher.id}/submit`)
    .set('Cookie', employeeSession.cookie)
    .set(CSRF, employeeSession.csrfToken)
    .expect(200)

  // Director signs only once the voucher awaits a decision.
  await uploadPng(directorSession, voucher.id, 'director')

  return voucher
}

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`

  Object.assign(employee, await fixtures.createFixtureUser('EMPLOYEE', 'DirectorT-Emp!42x'))
  Object.assign(director, await fixtures.createFixtureUser('DIRECTOR', 'DirectorT-Dir!42x'))
  Object.assign(accounts, await fixtures.createFixtureUser('ACCOUNTS', 'DirectorT-Acc!42x'))
  createdUserIds.push(employee.id, director.id, accounts.id)

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
describe('POST /api/v1/vouchers/:id/approve', () => {
  it('approves a PENDING_APPROVAL voucher with a Director signature: APPROVED + reviewedBy + event', async () => {
    const voucher = await createPendingVoucher('Approve me', 3210.55)
    const directorSession = await login(director)

    const response = await request(app)
      .post(`${API}/vouchers/${voucher.id}/approve`)
      .set('Cookie', directorSession.cookie)
      .set(CSRF, directorSession.csrfToken)
      .expect(200)

    expect(response.body.data.status).toBe('APPROVED')
    expect(response.body.data.approvedAt).not.toBeNull()
    expect(response.body.data.reviewedByName).toBeTruthy()

    const row = await prisma.voucher.findUniqueOrThrow({
      where: { id: voucher.id },
      select: { status: true, reviewedById: true, approvedAt: true, rejectionReason: true },
    })
    expect(row.status).toBe('APPROVED')
    expect(row.reviewedById).toBe(director.id)
    expect(row.approvedAt).not.toBeNull()
    expect(row.rejectionReason).toBeNull()

    const event = await prisma.voucherEvent.findFirst({
      where: { voucherId: voucher.id, type: 'APPROVED' },
      select: { actorId: true, fromStatus: true, toStatus: true },
    })
    expect(event).not.toBeNull()
    expect(event!.actorId).toBe(director.id)
    expect(event!.fromStatus).toBe('PENDING_APPROVAL')
    expect(event!.toStatus).toBe('APPROVED')
  })

  it('refuses approval without a Director signature (422)', async () => {
    const employeeSession = await login(employee)
    const directorSession = await login(director)

    // Employee signature only - no Director signature uploaded yet.
    const voucher = await createDraft(employeeSession, 'No director signature')
    await uploadPng(employeeSession, voucher.id, 'employee')
    await request(app)
      .post(`${API}/vouchers/${voucher.id}/submit`)
      .set('Cookie', employeeSession.cookie)
      .set(CSRF, employeeSession.csrfToken)
      .expect(200)

    const response = await request(app)
      .post(`${API}/vouchers/${voucher.id}/approve`)
      .set('Cookie', directorSession.cookie)
      .set(CSRF, directorSession.csrfToken)
      .expect(422)

    expect(response.body.error.message).toMatch(/director signature/i)

    const row = await prisma.voucher.findUniqueOrThrow({
      where: { id: voucher.id },
      select: { status: true },
    })
    expect(row.status).toBe('PENDING_APPROVAL')
  })

  it('refuses a double approve with 409 and keeps the first decision', async () => {
    const voucher = await createPendingVoucher('Double approve')
    const directorSession = await login(director)

    await request(app)
      .post(`${API}/vouchers/${voucher.id}/approve`)
      .set('Cookie', directorSession.cookie)
      .set(CSRF, directorSession.csrfToken)
      .expect(200)

    const second = await request(app)
      .post(`${API}/vouchers/${voucher.id}/approve`)
      .set('Cookie', directorSession.cookie)
      .set(CSRF, directorSession.csrfToken)
      .expect(409)

    expect(second.body.error.code).toBe('INVALID_STATE_TRANSITION')

    const approvedEvents = await prisma.voucherEvent.count({
      where: { voucherId: voucher.id, type: 'APPROVED' },
    })
    expect(approvedEvents).toBe(1)
  })

  it('survives two truly concurrent approvals with exactly one success', async () => {
    const voucher = await createPendingVoucher('Concurrent approve')
    const directorSession = await login(director)

    const decide = () =>
      request(app)
        .post(`${API}/vouchers/${voucher.id}/approve`)
        .set('Cookie', directorSession.cookie)
        .set(CSRF, directorSession.csrfToken)

    const results = await Promise.allSettled([decide(), decide()])
    const statuses = results.map((r) => (r.status === 'fulfilled' ? r.value.status : 0))

    expect(statuses.filter((s) => s === 200)).toHaveLength(1)
    expect(statuses.filter((s) => s === 409)).toHaveLength(1)

    const approvedEvents = await prisma.voucherEvent.count({
      where: { voucherId: voucher.id, type: 'APPROVED' },
    })
    expect(approvedEvents).toBe(1)
  })

  it('forbids Employee and Accounts from approving', async () => {
    const voucher = await createPendingVoucher('Role guard approve')

    for (const user of [employee, accounts]) {
      const session = await login(user)

      await request(app)
        .post(`${API}/vouchers/${voucher.id}/approve`)
        .set('Cookie', session.cookie)
        .set(CSRF, session.csrfToken)
        .expect(403)
    }

    const row = await prisma.voucher.findUniqueOrThrow({
      where: { id: voucher.id },
      select: { status: true },
    })
    expect(row.status).toBe('PENDING_APPROVAL')
  })

  it('refuses approving a draft or a missing voucher', async () => {
    const directorSession = await login(director)
    const employeeSession = await login(employee)
    const draft = await createDraft(employeeSession, 'Still a draft')
    await uploadPng(directorSession, draft.id, 'director')

    const draftApprove = await request(app)
      .post(`${API}/vouchers/${draft.id}/approve`)
      .set('Cookie', directorSession.cookie)
      .set(CSRF, directorSession.csrfToken)
      .expect(409)
    expect(draftApprove.body.error.code).toBe('INVALID_STATE_TRANSITION')

    await request(app)
      .post(`${API}/vouchers/${crypto.randomUUID()}/approve`)
      .set('Cookie', directorSession.cookie)
      .set(CSRF, directorSession.csrfToken)
      .expect(404)
  })

  it('rejects approval without a CSRF token', async () => {
    const voucher = await createPendingVoucher('CSRF approve')
    const directorSession = await login(director)

    await request(app)
      .post(`${API}/vouchers/${voucher.id}/approve`)
      .set('Cookie', directorSession.cookie)
      .expect(403)
  })

  it('keeps APPROVED terminal: no re-approve, no reject, no edit', async () => {
    const voucher = await createPendingVoucher('Terminal approve')
    const directorSession = await login(director)
    const employeeSession = await login(employee)

    await request(app)
      .post(`${API}/vouchers/${voucher.id}/approve`)
      .set('Cookie', directorSession.cookie)
      .set(CSRF, directorSession.csrfToken)
      .expect(200)

    await request(app)
      .post(`${API}/vouchers/${voucher.id}/reject`)
      .set('Cookie', directorSession.cookie)
      .set(CSRF, directorSession.csrfToken)
      .send({ reason: 'Changing my mind after approval' })
      .expect(409)

    await request(app)
      .patch(`${API}/vouchers/${voucher.id}`)
      .set('Cookie', employeeSession.cookie)
      .set(CSRF, employeeSession.csrfToken)
      .send({ expenseTitle: 'post-approval edit' })
      .expect(409)
  })
})

// ---------------------------------------------------------------------------
describe('POST /api/v1/vouchers/:id/reject', () => {
  it('rejects with a reason: REJECTED + reviewedBy + reason + event metadata', async () => {
    const voucher = await createPendingVoucher('Reject me')
    const directorSession = await login(director)

    const reason = 'Amount does not match the attached invoice lines.'

    const response = await request(app)
      .post(`${API}/vouchers/${voucher.id}/reject`)
      .set('Cookie', directorSession.cookie)
      .set(CSRF, directorSession.csrfToken)
      .send({ reason })
      .expect(200)

    expect(response.body.data.status).toBe('REJECTED')
    expect(response.body.data.rejectionReason).toBe(reason)

    const row = await prisma.voucher.findUniqueOrThrow({
      where: { id: voucher.id },
      select: { status: true, reviewedById: true, rejectedAt: true, rejectionReason: true },
    })
    expect(row.status).toBe('REJECTED')
    expect(row.reviewedById).toBe(director.id)
    expect(row.rejectedAt).not.toBeNull()
    expect(row.rejectionReason).toBe(reason)

    const event = await prisma.voucherEvent.findFirst({
      where: { voucherId: voucher.id, type: 'REJECTED' },
      select: { metadata: true },
    })
    expect(event).not.toBeNull()
    expect((event!.metadata as { reason?: string }).reason).toBe(reason)
  })

  it('trims the reason and rejects an empty or whitespace-only reason', async () => {
    const voucher = await createPendingVoucher('Trim reject')
    const directorSession = await login(director)

    const response = await request(app)
      .post(`${API}/vouchers/${voucher.id}/reject`)
      .set('Cookie', directorSession.cookie)
      .set(CSRF, directorSession.csrfToken)
      .send({ reason: '  Duplicate of PV-2026-0007.  ' })
      .expect(200)

    expect(response.body.data.rejectionReason).toBe('Duplicate of PV-2026-0007.')

    for (const bad of ['', '   ']) {
      await request(app)
        .post(`${API}/vouchers/${crypto.randomUUID()}/reject`)
        .set('Cookie', directorSession.cookie)
        .set(CSRF, directorSession.csrfToken)
        .send({ reason: bad })
        .expect(400)
    }
  })

  it('refuses rejection without a Director signature (422)', async () => {
    const employeeSession = await login(employee)
    const directorSession = await login(director)

    const voucher = await createDraft(employeeSession, 'Reject without director sig')
    await uploadPng(employeeSession, voucher.id, 'employee')
    await request(app)
      .post(`${API}/vouchers/${voucher.id}/submit`)
      .set('Cookie', employeeSession.cookie)
      .set(CSRF, employeeSession.csrfToken)
      .expect(200)

    await request(app)
      .post(`${API}/vouchers/${voucher.id}/reject`)
      .set('Cookie', directorSession.cookie)
      .set(CSRF, directorSession.csrfToken)
      .send({ reason: 'Cannot decide without my signature attached.' })
      .expect(422)

    const row = await prisma.voucher.findUniqueOrThrow({
      where: { id: voucher.id },
      select: { status: true },
    })
    expect(row.status).toBe('PENDING_APPROVAL')
  })

  it('keeps REJECTED terminal and read-only for the employee', async () => {
    const voucher = await createPendingVoucher('Terminal reject')
    const directorSession = await login(director)
    const employeeSession = await login(employee)

    await request(app)
      .post(`${API}/vouchers/${voucher.id}/reject`)
      .set('Cookie', directorSession.cookie)
      .set(CSRF, directorSession.csrfToken)
      .send({ reason: 'Not eligible under policy 4.2.' })
      .expect(200)

    // No edit, no delete, no re-submit, no second decision.
    await request(app)
      .patch(`${API}/vouchers/${voucher.id}`)
      .set('Cookie', employeeSession.cookie)
      .set(CSRF, employeeSession.csrfToken)
      .send({ amount: 1 })
      .expect(409)

    await request(app)
      .delete(`${API}/vouchers/${voucher.id}`)
      .set('Cookie', employeeSession.cookie)
      .set(CSRF, employeeSession.csrfToken)
      .expect(409)

    await request(app)
      .post(`${API}/vouchers/${voucher.id}/submit`)
      .set('Cookie', employeeSession.cookie)
      .set(CSRF, employeeSession.csrfToken)
      .expect(409)

    await request(app)
      .post(`${API}/vouchers/${voucher.id}/approve`)
      .set('Cookie', directorSession.cookie)
      .set(CSRF, directorSession.csrfToken)
      .expect(409)
  })

  it('forbids Employee and Accounts from rejecting', async () => {
    const voucher = await createPendingVoucher('Role guard reject')

    for (const user of [employee, accounts]) {
      const session = await login(user)

      await request(app)
        .post(`${API}/vouchers/${voucher.id}/reject`)
        .set('Cookie', session.cookie)
        .set(CSRF, session.csrfToken)
        .send({ reason: 'An employee should never be able to set this.' })
        .expect(403)
    }
  })

  it('survives concurrent approve vs reject with exactly one winner', async () => {
    const voucher = await createPendingVoucher('Mixed concurrency')
    const directorSession = await login(director)

    const approve = request(app)
      .post(`${API}/vouchers/${voucher.id}/approve`)
      .set('Cookie', directorSession.cookie)
      .set(CSRF, directorSession.csrfToken)

    const reject = request(app)
      .post(`${API}/vouchers/${voucher.id}/reject`)
      .set('Cookie', directorSession.cookie)
      .set(CSRF, directorSession.csrfToken)
      .send({ reason: 'Race condition probe.' })

    const [approveResult, rejectResult] = await Promise.allSettled([approve, reject])
    const approveStatus = approveResult.status === 'fulfilled' ? approveResult.value.status : 0
    const rejectStatus = rejectResult.status === 'fulfilled' ? rejectResult.value.status : 0

    expect([approveStatus, rejectStatus].filter((s) => s === 200)).toHaveLength(1)
    expect([approveStatus, rejectStatus].filter((s) => s === 409)).toHaveLength(1)

    const row = await prisma.voucher.findUniqueOrThrow({
      where: { id: voucher.id },
      select: { status: true },
    })
    expect(['APPROVED', 'REJECTED']).toContain(row.status)

    // Exactly one terminal decision event was recorded.
    const decisionEvents = await prisma.voucherEvent.count({
      where: { voucherId: voucher.id, type: { in: ['APPROVED', 'REJECTED'] } },
    })
    expect(decisionEvents).toBe(1)
  })
})

// ---------------------------------------------------------------------------
describe('GET /api/v1/vouchers/director/dashboard', () => {
  it('returns pending count, pending amount and recent activity', async () => {
    const directorSession = await login(director)

    const voucher = await createPendingVoucher('Dashboard pending probe', 1234.56)

    const response = await request(app)
      .get(`${API}/vouchers/director/dashboard`)
      .set('Cookie', directorSession.cookie)
      .expect(200)

    const data = response.body.data
    expect(data.pendingApprovalCount).toBeGreaterThan(0)
    expect(data.totalPendingAmount).toMatch(/^\d+(\.\d{2})?$/)
    expect(Number(data.totalPendingAmount)).toBeGreaterThanOrEqual(1234.56)
    expect(typeof data.approvedToday).toBe('number')
    expect(typeof data.rejectedToday).toBe('number')
    expect(Array.isArray(data.recentActivity)).toBe(true)
    expect(data.recentActivity.length).toBeGreaterThan(0)

    const pendingIds = (data.recentVouchers as { id: string }[]).map((v) => v.id)
    expect(pendingIds).toContain(voucher.id)
  })

  it('reflects an approval immediately in the aggregates', async () => {
    const directorSession = await login(director)

    const voucher = await createPendingVoucher('Reflect approval probe', 500)

    const before = await request(app)
      .get(`${API}/vouchers/director/dashboard`)
      .set('Cookie', directorSession.cookie)
      .expect(200)

    await request(app)
      .post(`${API}/vouchers/${voucher.id}/approve`)
      .set('Cookie', directorSession.cookie)
      .set(CSRF, directorSession.csrfToken)
      .expect(200)

    const after = await request(app)
      .get(`${API}/vouchers/director/dashboard`)
      .set('Cookie', directorSession.cookie)
      .expect(200)

    expect(after.body.data.pendingApprovalCount).toBe(before.body.data.pendingApprovalCount - 1)
    expect(after.body.data.approvedToday).toBeGreaterThan(before.body.data.approvedToday)
  })

  it('refuses the director dashboard for Employee and Accounts', async () => {
    for (const user of [employee, accounts]) {
      const session = await login(user)

      await request(app)
        .get(`${API}/vouchers/director/dashboard`)
        .set('Cookie', session.cookie)
        .expect(403)
    }
  })
})
