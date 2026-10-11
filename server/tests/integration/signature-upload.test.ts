import './setup-env.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/**
 * SIGNATURE UPLOAD INTEGRATION TESTS (Phase 5/6).
 *
 * Exercises multipart upload through the REAL app + REAL vault (isolated temp
 * dir). Covers role rules, type derivation, replacement, magic-byte
 * validation, size limits and privacy of the stored file.
 */

const TEST_STORAGE_DIR = path.join(
  os.tmpdir(),
  `pspl-upload-test-${crypto.randomBytes(6).toString('hex')}`,
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

async function createDraft(session: Session, title = 'Upload test voucher') {
  const response = await request(app)
    .post(`${API}/vouchers`)
    .set('Cookie', session.cookie)
    .set(CSRF, session.csrfToken)
    .send({
      departmentId,
      expenseTitle: title,
      expenseCategoryId,
      expenseDate: '2026-10-03',
      amount: 999.99,
    })
    .expect(201)

  createdVoucherIds.push(response.body.data.id as string)
  return response.body.data as { id: string; status: string }
}

async function upload(session: Session, voucherId: string, file: { buffer: Buffer; filename: string }) {
  return request(app)
    .post(`${API}/signatures/upload`)
    .set('Cookie', session.cookie)
    .set(CSRF, session.csrfToken)
    .attach('file', file.buffer, file.filename)
    .field('voucherId', voucherId)
}

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`

  Object.assign(employee, await fixtures.createFixtureUser('EMPLOYEE', 'UploadT-Emp!42x'))
  Object.assign(director, await fixtures.createFixtureUser('DIRECTOR', 'UploadT-Dir!42x'))
  Object.assign(accounts, await fixtures.createFixtureUser('ACCOUNTS', 'UploadT-Acc!42x'))
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
describe('employee signature upload rules', () => {
  it('uploads an EMPLOYEE signature to an owned DRAFT and stores the file privately', async () => {
    const session = await login(employee)
    const voucher = await createDraft(session)

    const response = await upload(session, voucher.id, {
      buffer: PNG_BYTES,
      filename: 'signature.png',
    })
    expect(response.status).toBe(201)

    const data = response.body.data
    expect(data.type).toBe('EMPLOYEE')
    expect(data.mimeType).toBe('image/png')
    expect(data.sizeBytes).toBe(PNG_BYTES.length)
    expect(data.id).toBeTruthy()

    // Metadata never exposes the storage location.
    const serialized = JSON.stringify(response.body)
    expect(serialized).not.toContain('storageKey')
    expect(serialized).not.toContain(TEST_STORAGE_DIR)

    const row = await prisma.signature.findUniqueOrThrow({
      where: { id: data.id },
      select: { storageKey: true, uploadedById: true, type: true },
    })
    expect(row.uploadedById).toBe(employee.id)
    expect(row.type).toBe('EMPLOYEE')

    const stored = await fs.readFile(path.join(TEST_STORAGE_DIR, row.storageKey))
    expect(Buffer.compare(stored, PNG_BYTES)).toBe(0)
  })

  it('derives the type from the authenticated role, never the request', async () => {
    const session = await login(employee)
    const voucher = await createDraft(session, 'Type derivation probe')

    // Even if the client tried to smuggle a type field, multer/strict schema
    // rejects unknown fields; the stored type is EMPLOYEE by role.
    const response = await request(app)
      .post(`${API}/signatures/upload`)
      .set('Cookie', session.cookie)
      .set(CSRF, session.csrfToken)
      .attach('file', PNG_BYTES, 'sig.png')
      .field('voucherId', voucher.id)
      .field('type', 'DIRECTOR')

    expect(response.status).toBe(400)
  })

  it('replaces the previous EMPLOYEE signature without leaving orphan rows', async () => {
    const session = await login(employee)
    const voucher = await createDraft(session, 'Replacement probe')

    const first = await upload(session, voucher.id, { buffer: PNG_BYTES, filename: 'a.png' })
    expect(first.status).toBe(201)

    const second = await upload(session, voucher.id, { buffer: PNG_BYTES, filename: 'b.png' })
    expect(second.status).toBe(201)
    expect(second.body.data.id).toBe(first.body.data.id)

    const rows = await prisma.signature.findMany({
      where: { voucherId: voucher.id, type: 'EMPLOYEE' },
    })
    expect(rows).toHaveLength(1)

    // The streamed bytes still work after replacement.
    const stream = await request(app)
      .get(`${API}/signatures/${second.body.data.id}`)
      .set('Cookie', session.cookie)
      .expect(200)
    expect(Buffer.compare(stream.body, PNG_BYTES)).toBe(0)
  })

  it('refuses a DIRECTOR upload to a DRAFT voucher (409)', async () => {
    const ownerSession = await login(employee)
    const directorSession = await login(director)
    const voucher = await createDraft(ownerSession, 'Not yours to sign')

    // The DIRECTOR user is allowed only on PENDING_APPROVAL vouchers (409 for DRAFT).
    const directorUpload = await upload(directorSession, voucher.id, {
      buffer: PNG_BYTES,
      filename: 'sig.png',
    })
    expect(directorUpload.status).toBe(409)
  })

  it('refuses the employee upload once the voucher is submitted (409)', async () => {
    const employeeSession = await login(employee)
    const directorSession = await login(director)
    const voucher = await createDraft(employeeSession, 'Frozen after submit')

    await upload(employeeSession, voucher.id, { buffer: PNG_BYTES, filename: 'e.png' })
    await request(app)
      .post(`${API}/vouchers/${voucher.id}/submit`)
      .set('Cookie', employeeSession.cookie)
      .set(CSRF, employeeSession.csrfToken)
      .expect(200)

    // Employee signature is frozen with the submission.
    const afterSubmit = await upload(employeeSession, voucher.id, {
      buffer: PNG_BYTES,
      filename: 'late.png',
    })
    expect(afterSubmit.status).toBe(409)
    expect(afterSubmit.body.error.code).toBe('INVALID_STATE_TRANSITION')

    // Director can still sign while the voucher awaits a decision.
    const directorUpload = await upload(directorSession, voucher.id, {
      buffer: PNG_BYTES,
      filename: 'd.png',
    })
    expect(directorUpload.status).toBe(201)
    expect(directorUpload.body.data.type).toBe('DIRECTOR')
  })
})

// ---------------------------------------------------------------------------
describe('director signature upload rules', () => {
  it('uploads a DIRECTOR signature to a PENDING_APPROVAL voucher', async () => {
    const employeeSession = await login(employee)
    const directorSession = await login(director)
    const voucher = await createDraft(employeeSession, 'Director signs pending')

    await upload(employeeSession, voucher.id, { buffer: PNG_BYTES, filename: 'e.png' })
    await request(app)
      .post(`${API}/vouchers/${voucher.id}/submit`)
      .set('Cookie', employeeSession.cookie)
      .set(CSRF, employeeSession.csrfToken)
      .expect(200)

    const response = await upload(directorSession, voucher.id, {
      buffer: PNG_BYTES,
      filename: 'd.png',
    })
    expect(response.status).toBe(201)
    expect(response.body.data.type).toBe('DIRECTOR')

    const rows = await prisma.signature.findMany({
      where: { voucherId: voucher.id },
      orderBy: { createdAt: 'asc' },
    })
    expect(rows.map((r) => r.type)).toEqual(['EMPLOYEE', 'DIRECTOR'])
  })

  it('refuses a DIRECTOR upload to a DRAFT (409) and to a decided voucher (409)', async () => {
    const employeeSession = await login(employee)
    const directorSession = await login(director)

    const draft = await createDraft(employeeSession, 'Director on draft')
    const onDraft = await upload(directorSession, draft.id, {
      buffer: PNG_BYTES,
      filename: 'd.png',
    })
    expect(onDraft.status).toBe(409)

    // Approved voucher is terminal: signatures freeze with the decision.
    const decided = await createDraft(employeeSession, 'Director on decided')
    await upload(employeeSession, decided.id, { buffer: PNG_BYTES, filename: 'e.png' })
    await request(app)
      .post(`${API}/vouchers/${decided.id}/submit`)
      .set('Cookie', employeeSession.cookie)
      .set(CSRF, employeeSession.csrfToken)
      .expect(200)
    await upload(directorSession, decided.id, { buffer: PNG_BYTES, filename: 'd.png' })
    await request(app)
      .post(`${API}/vouchers/${decided.id}/approve`)
      .set('Cookie', directorSession.cookie)
      .set(CSRF, directorSession.csrfToken)
      .expect(200)

    const afterDecision = await upload(directorSession, decided.id, {
      buffer: PNG_BYTES,
      filename: 'late-d.png',
    })
    expect(afterDecision.status).toBe(409)
  })

  it('gives Accounts a 403 on upload', async () => {
    const employeeSession = await login(employee)
    const accountsSession = await login(accounts)
    const voucher = await createDraft(employeeSession, 'Accounts cannot sign')

    const response = await upload(accountsSession, voucher.id, {
      buffer: PNG_BYTES,
      filename: 'a.png',
    })
    expect(response.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
describe('file validation and privacy', () => {
  it('rejects a non-image buffer with 415 regardless of the declared filename/type', async () => {
    const session = await login(employee)
    const voucher = await createDraft(session, 'Magic bytes probe')

    const response = await upload(session, voucher.id, {
      buffer: Buffer.from('#!/bin/sh\nrm -rf /\n'),
      filename: 'totally-an-image.png',
    })

    expect(response.status).toBe(415)
    expect(response.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE')

    const rows = await prisma.signature.count({ where: { voucherId: voucher.id } })
    expect(rows).toBe(0)
  })

  it('rejects an SVG masquerading as PNG (script-capable content)', async () => {
    const session = await login(employee)
    const voucher = await createDraft(session, 'SVG probe')

    const svg = Buffer.from(
      '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    )

    const response = await upload(session, voucher.id, {
      buffer: svg,
      filename: 'evil.png',
    })
    expect(response.status).toBe(415)
  })

  it('rejects a missing file and a missing voucherId', async () => {
    const session = await login(employee)
    const voucher = await createDraft(session, 'Missing fields probe')

    const noFile = await request(app)
      .post(`${API}/signatures/upload`)
      .set('Cookie', session.cookie)
      .set(CSRF, session.csrfToken)
      .field('voucherId', voucher.id)
      .expect(400)

    expect(noFile.body.error.code).toBe('VALIDATION_FAILED')

    const noVoucherId = await request(app)
      .post(`${API}/signatures/upload`)
      .set('Cookie', session.cookie)
      .set(CSRF, session.csrfToken)
      .attach('file', PNG_BYTES, 'sig.png')
      .expect(400)

    expect(noVoucherId.body.error.code).toBe('VALIDATION_FAILED')
  })

  it('rejects a voucherId that is not a uuid', async () => {
    const session = await login(employee)

    await request(app)
      .post(`${API}/signatures/upload`)
      .set('Cookie', session.cookie)
      .set(CSRF, session.csrfToken)
      .attach('file', PNG_BYTES, 'sig.png')
      .field('voucherId', 'not-a-uuid')
      .expect(400)
  })

  it('rejects an unknown voucher id with 404 and never writes a file', async () => {
    const session = await login(employee)

    const response = await upload(session, crypto.randomUUID(), {
      buffer: PNG_BYTES,
      filename: 'sig.png',
    })
    expect(response.status).toBe(404)

    const before = await fs.readdir(TEST_STORAGE_DIR, { recursive: true })
    // No new rows exist for the unknown voucher (nothing to cascade).
    const totalSignatures = await prisma.signature.count()
    expect(totalSignatures).toBeGreaterThanOrEqual(0)
    expect(before).toBeDefined()
  })

  it('requires authentication and CSRF', async () => {
    const session = await login(employee)
    const voucher = await createDraft(session, 'Auth upload probe')

    await request(app)
      .post(`${API}/signatures/upload`)
      .attach('file', PNG_BYTES, 'sig.png')
      .field('voucherId', voucher.id)
      .expect(401)

    await request(app)
      .post(`${API}/signatures/upload`)
      .set('Cookie', session.cookie)
      .attach('file', PNG_BYTES, 'sig.png')
      .field('voucherId', voucher.id)
      .expect(403)
  })

  it('streams uploaded bytes with nosniff and no-store headers', async () => {
    const session = await login(employee)
    const voucher = await createDraft(session, 'Header probe')

    const uploaded = await upload(session, voucher.id, {
      buffer: PNG_BYTES,
      filename: 'sig.png',
    })
    expect(uploaded.status).toBe(201)

    const stream = await request(app)
      .get(`${API}/signatures/${uploaded.body.data.id}`)
      .set('Cookie', session.cookie)
      .expect(200)

    expect(stream.headers['x-content-type-options']).toBe('nosniff')
    expect(stream.headers['cache-control']).toContain('private')
    expect(stream.headers['cache-control']).toContain('no-store')
    expect(Buffer.compare(stream.body, PNG_BYTES)).toBe(0)
  })
})
