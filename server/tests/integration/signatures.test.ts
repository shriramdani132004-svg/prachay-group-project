import './setup-env.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/**
 * SIGNATURE ACCESS AUTHORIZATION INTEGRATION TESTS.
 *
 * Exercises the REAL Express app and the REAL private storage abstraction
 * against a REAL database. The storage root is an isolated temporary directory
 * so no development signature is ever read, written or deleted here.
 *
 * Policy under test (src/middleware/auth-contract.ts):
 * - Anonymous: always denied.
 * - EMPLOYEE: only signatures attached to vouchers they created.
 * - DIRECTOR / ACCOUNTS: organization-wide read access.
 * - Failures disclose nothing: no storage keys, no filesystem paths, no
 *   existence oracle between "unauthorized" and "does not exist".
 */

// Isolated vault: set BEFORE the config module is imported anywhere.
const TEST_STORAGE_DIR = path.join(
  os.tmpdir(),
  `pspl-signature-test-${crypto.randomBytes(6).toString('hex')}`,
)
process.env.SIGNATURE_STORAGE_DIR = TEST_STORAGE_DIR

const { createApp } = await import('../../src/app.js')
const { prisma } = await import('../../src/lib/prisma.js')
const { LocalSignatureStorage } = await import('../../src/modules/signatures/signature-storage.js')
const fixtures = await import('./fixtures.js')

const app = createApp()
const API = '/api/v1'

/** A genuine 1x1 PNG; magic bytes are what the storage layer validates. */
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
const accountsUser = { id: '', email: '', fullName: '', role: 'ACCOUNTS' as const, password: '' }
const director = { id: '', email: '', fullName: '', role: 'DIRECTOR' as const, password: '' }

const createdUserIds: string[] = []

// Signature records created by this file, removed explicitly in afterAll.
const signatureIds: string[] = []
let signatureA = ''
let signatureB = ''
let orphanSignatureId = ''
let traversalSignatureId = ''
let storedKeyForStaticCheck = ''

async function login(user: { email: string; password: string }): Promise<Session> {
  const response = await request(app)
    .post(`${API}/auth/login`)
    .send({ email: user.email, password: user.password })
    .expect(200)

  const cookies = response.headers['set-cookie'] as unknown as string[]
  return {
    cookie: cookies.map((c) => c.split(';')[0]).join('; '),
    csrfToken: response.body.data.csrfToken as string,
  }
}

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`

  Object.assign(employeeA, await fixtures.createFixtureUser('EMPLOYEE', 'Signature-A-Pass!42'))
  Object.assign(employeeB, await fixtures.createFixtureUser('EMPLOYEE', 'Signature-B-Pass!42'))
  Object.assign(accountsUser, await fixtures.createFixtureUser('ACCOUNTS', 'Signature-Acc!42'))
  Object.assign(director, await fixtures.createFixtureUser('DIRECTOR', 'Signature-Dir!42'))
  createdUserIds.push(employeeA.id, employeeB.id, accountsUser.id, director.id)

  const storage = new LocalSignatureStorage(TEST_STORAGE_DIR, 2 * 1024 * 1024)
  const storedA = await storage.store(PNG_BYTES)
  const storedB = await storage.store(PNG_BYTES)
  storedKeyForStaticCheck = storedA.storageKey

  const voucherA = await fixtures.createFixtureVoucher(employeeA.id, 'APPROVED')
  const voucherB = await fixtures.createFixtureVoucher(employeeB.id, 'APPROVED')

  const rowA = await prisma.signature.create({
    data: {
      voucherId: voucherA.id,
      uploadedById: employeeA.id,
      type: 'EMPLOYEE',
      storageKey: storedA.storageKey,
      mimeType: storedA.mimeType,
      sizeBytes: storedA.sizeBytes,
      sha256: storedA.sha256,
    },
    select: { id: true },
  })
  signatureA = rowA.id
  signatureIds.push(rowA.id)

  const rowB = await prisma.signature.create({
    data: {
      voucherId: voucherB.id,
      uploadedById: employeeB.id,
      type: 'EMPLOYEE',
      storageKey: storedB.storageKey,
      mimeType: storedB.mimeType,
      sizeBytes: storedB.sizeBytes,
      sha256: storedB.sha256,
    },
    select: { id: true },
  })
  signatureB = rowB.id
  signatureIds.push(rowB.id)

  // Metadata whose backing file was deliberately never written.
  const voucherOrphan = await fixtures.createFixtureVoucher(employeeA.id, 'DRAFT')
  const orphan = await prisma.signature.create({
    data: {
      voucherId: voucherOrphan.id,
      uploadedById: employeeA.id,
      type: 'EMPLOYEE',
      storageKey: 'ff/ee/nonexistent-file-on-disk.png',
      mimeType: 'image/png',
      sizeBytes: PNG_BYTES.length,
      sha256: crypto.createHash('sha256').update(PNG_BYTES).digest('hex'),
    },
    select: { id: true },
  })
  orphanSignatureId = orphan.id
  signatureIds.push(orphan.id)

  // Metadata poisoned with a traversal key; must never read outside the root.
  const voucherTraversal = await fixtures.createFixtureVoucher(employeeA.id, 'DRAFT')
  const traversal = await prisma.signature.create({
    data: {
      voucherId: voucherTraversal.id,
      uploadedById: employeeA.id,
      type: 'EMPLOYEE',
      storageKey: '../../../../pspl-traversal-canary.png',
      mimeType: 'image/png',
      sizeBytes: PNG_BYTES.length,
      sha256: crypto.createHash('sha256').update(PNG_BYTES).digest('hex'),
    },
    select: { id: true },
  })
  traversalSignatureId = traversal.id
  signatureIds.push(traversal.id)
})

afterAll(async () => {
  if (signatureIds.length > 0) {
    await prisma.signature.deleteMany({ where: { id: { in: signatureIds } } })
  }
  await fixtures.cleanupFixtures(createdUserIds)
  await fs.rm(TEST_STORAGE_DIR, { recursive: true, force: true })
  await prisma.$disconnect()
})

// ---------------------------------------------------------------------------
describe('anonymous access', () => {
  it('denies unsigned access to a signature', async () => {
    const response = await request(app).get(`${API}/signatures/${signatureA}`).expect(401)

    expect(response.body.error.code).toBe('UNAUTHORIZED')
  })

  it('denies unsigned access even with a plausible id', async () => {
    await request(app).get(`${API}/signatures/${crypto.randomUUID()}`).expect(401)
  })

  it('denies anonymous upload attempts', async () => {
    await request(app).post(`${API}/signatures/upload`).expect(401)
  })
})

// ---------------------------------------------------------------------------
describe('employee ownership (IDOR)', () => {
  it('lets Employee A download their own signature bytes', async () => {
    const session = await login(employeeA)

    const response = await request(app)
      .get(`${API}/signatures/${signatureA}`)
      .set('Cookie', session.cookie)
      .expect(200)

    expect(response.headers['content-type']).toContain('image/png')
    expect(response.headers['cache-control']).toContain('private')
    expect(Buffer.compare(response.body, PNG_BYTES)).toBe(0)
  })

  it("blocks Employee A from Employee B's signature and does not disclose existence", async () => {
    const session = await login(employeeA)

    const blocked = await request(app)
      .get(`${API}/signatures/${signatureB}`)
      .set('Cookie', session.cookie)
      .expect(404)

    // The response must be indistinguishable from a signature that never
    // existed, so changing the ID cannot be used to probe other users' data.
    const nonexistent = await request(app)
      .get(`${API}/signatures/${crypto.randomUUID()}`)
      .set('Cookie', session.cookie)
      .expect(404)

    expect(blocked.body.error.code).toBe('NOT_FOUND')
    expect(blocked.body.error.message).toBe(nonexistent.body.error.message)
  })

  it('cannot bypass voucher ownership by substituting the signature id', async () => {
    const session = await login(employeeA)

    // A crafted "near-miss" id derived from B's record still fails closed.
    const mutated = signatureB.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'))
    const response = await request(app)
      .get(`${API}/signatures/${mutated}`)
      .set('Cookie', session.cookie)
      .expect(404)

    expect(response.body.error.code).toBe('NOT_FOUND')
  })

  it("blocks Employee B from Employee A's signature", async () => {
    const session = await login(employeeB)

    const response = await request(app)
      .get(`${API}/signatures/${signatureA}`)
      .set('Cookie', session.cookie)
      .expect(404)

    expect(response.body.error.code).toBe('NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
describe('director and accounts policy', () => {
  it('grants Accounts organization-wide signature read access', async () => {
    const session = await login(accountsUser)

    for (const id of [signatureA, signatureB]) {
      const response = await request(app)
        .get(`${API}/signatures/${id}`)
        .set('Cookie', session.cookie)
        .expect(200)

      expect(Buffer.compare(response.body, PNG_BYTES)).toBe(0)
    }
  })

  it('grants Director organization-wide signature read access', async () => {
    const session = await login(director)

    const response = await request(app)
      .get(`${API}/signatures/${signatureB}`)
      .set('Cookie', session.cookie)
      .expect(200)

    expect(Buffer.compare(response.body, PNG_BYTES)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
describe('hostile metadata never leaks internals', () => {
  it('returns a generic error when the backing file is missing, without paths', async () => {
    const session = await login(employeeA)

    const response = await request(app)
      .get(`${API}/signatures/${orphanSignatureId}`)
      .set('Cookie', session.cookie)
      .expect(500)

    expect(response.body.error.code).toBe('INTERNAL_ERROR')
    const serialized = JSON.stringify(response.body)
    expect(serialized).not.toContain('nonexistent-file-on-disk.png')
    expect(serialized).not.toContain(TEST_STORAGE_DIR)
    expect(serialized).not.toContain('ENOENT')
  })

  it('blocks a traversal storage key without reading outside the vault', async () => {
    const session = await login(employeeA)

    const response = await request(app)
      .get(`${API}/signatures/${traversalSignatureId}`)
      .set('Cookie', session.cookie)
      .expect(400)

    expect(response.body.error.code).toBe('BAD_REQUEST')
    const serialized = JSON.stringify(response.body)
    expect(serialized).not.toContain('pspl-traversal-canary.png')
    expect(serialized).not.toContain(TEST_STORAGE_DIR)
  })

  it('rejects a non-uuid signature id', async () => {
    const session = await login(employeeA)

    const response = await request(app)
      .get(`${API}/signatures/not-a-uuid`)
      .set('Cookie', session.cookie)
      .expect(400)

    expect(['VALIDATION_FAILED', 'BAD_REQUEST']).toContain(response.body.error.code)
  })
})

// ---------------------------------------------------------------------------
describe('no public route exists for signature files', () => {
  it('does not serve the storage directory as static files', async () => {
    const response = await request(app)
      .get(`/storage/signatures/${storedKeyForStaticCheck}`)
      .expect(404)

    expect(response.body.error.code).toBe('NOT_FOUND')
  })

  it('requires auth and CSRF on upload, then a real file (Phase 5)', async () => {
    // Anonymous upload is still denied outright.
    await request(app).post(`${API}/signatures/upload`).expect(401)

    const session = await login(employeeA)

    // Authenticated + CSRF but no file: the route exists and validates input.
    const response = await request(app)
      .post(`${API}/signatures/upload`)
      .set('Cookie', session.cookie)
      .set('x-csrf-token', session.csrfToken)
      .expect(400)

    expect(response.body.error.code).toBe('VALIDATION_FAILED')
  })
})
