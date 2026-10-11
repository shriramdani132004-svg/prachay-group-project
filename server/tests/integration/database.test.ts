import './setup-env.js'
import { afterAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/lib/prisma.js'
import { cleanupFixtures, createFixtureUser, sessionCookieHeader } from './fixtures.js'

/**
 * Database-backed integration tests against a REAL PostgreSQL instance.
 *
 * Availability is probed with a TOP-LEVEL AWAIT, BEFORE Vitest collects tests.
 * A `beforeAll` probe would be too late: `it.skipIf(...)` is evaluated during
 * collection, so the flag would still read `false` and every database test would
 * be silently skipped against a perfectly healthy database.
 */
const API = '/api/v1'
const app = createApp()

const databaseAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch((error: unknown) => {
    console.error(
      '[BLOCKED] PostgreSQL is unreachable, so database integration tests cannot run:',
      error instanceof Error ? error.message : error,
    )
    return false
  })

if (!databaseAvailable) {
  console.warn('[BLOCKED] Database integration tests were SKIPPED because PostgreSQL is unreachable.')
}

/**
 * Phase 4 made departments and expense-categories authenticated. These tests
 * still verify the PERSISTED data, so they present a real session. The
 * authentication behaviour itself is proven in auth.test.ts.
 */
let authCookie = ''
let authUserId = ''

async function ensureAuthCookie(): Promise<string> {
  if (authCookie) return authCookie

  const user = await createFixtureUser('DIRECTOR', 'Phase3-Regression-Auth!42')
  authUserId = user.id

  const response = await request(app)
    .post(`${API}/auth/login`)
    .send({ email: user.email, password: user.password })
    .expect(200)

  authCookie = sessionCookieHeader(response.headers['set-cookie'])
  return authCookie
}

afterAll(async () => {
  if (authUserId) await cleanupFixtures([authUserId])
  await prisma.$disconnect()
})

describe('GET /api/v1/health/live', () => {
  it('reports liveness without touching the database', async () => {
    const response = await request(app).get(`${API}/health/live`).expect(200)

    expect(response.body.success).toBe(true)
    expect(response.body.data.status).toBe('alive')
    expect(typeof response.body.data.uptimeSeconds).toBe('number')
  })
})

describe('GET /api/v1/health/ready', () => {
  it.skipIf(!databaseAvailable)('reports ready when the database is reachable', async () => {
    const response = await request(app).get(`${API}/health/ready`).expect(200)

    expect(response.body.success).toBe(true)
    expect(response.body.data.status).toBe('ready')
    expect(response.body.data.database).toBe('up')
  })

  it.skipIf(!databaseAvailable)(
    'returns 503 with a safe envelope when the database is down',
    async () => {
      const original = prisma.$queryRaw.bind(prisma)
      prisma.$queryRaw = (async () => {
        throw new Error('simulated connection failure')
      }) as typeof prisma.$queryRaw

      try {
        const response = await request(app).get(`${API}/health/ready`).expect(503)

        expect(response.body.success).toBe(false)
        expect(response.body.error.code).toBe('DATABASE_UNAVAILABLE')
        // The internal failure detail must not reach the client.
        expect(JSON.stringify(response.body)).not.toMatch(/simulated connection failure/)
      } finally {
        prisma.$queryRaw = original
      }
    },
  )
})

describe('GET /api/v1/health', () => {
  it.skipIf(!databaseAvailable)(
    'returns 200 only when database connectivity is confirmed',
    async () => {
      const response = await request(app).get(`${API}/health`).expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('healthy')
      expect(response.body.data.checks.database.status).toBe('up')
      expect(typeof response.body.data.checks.database.latencyMs).toBe('number')
    },
  )

  it.skipIf(!databaseAvailable)('never leaks connection details', async () => {
    const response = await request(app).get(`${API}/health`)
    const body = JSON.stringify(response.body)

    expect(body).not.toMatch(/postgresql:\/\//i)
    expect(body).not.toMatch(/5433/)
    expect(body).not.toMatch(/password/i)
  })
})

describe('GET /api/v1/departments', () => {
  it.skipIf(!databaseAvailable)('requires authentication', async () => {
    await request(app).get(`${API}/departments`).expect(401)
  })

  it.skipIf(!databaseAvailable)('returns persisted departments from PostgreSQL', async () => {
    const cookie = await ensureAuthCookie()
    const response = await request(app).get(`${API}/departments`).set('Cookie', cookie).expect(200)

    expect(response.body.success).toBe(true)
    expect(Array.isArray(response.body.data)).toBe(true)
    expect(response.body.data.length).toBeGreaterThan(0)

    const first = response.body.data[0]
    expect(first).toHaveProperty('id')
    expect(first).toHaveProperty('code')
    expect(first).toHaveProperty('name')
    expect(first).not.toHaveProperty('passwordHash')
  })

  it.skipIf(!databaseAvailable)('returns pagination metadata', async () => {
    const cookie = await ensureAuthCookie()
    const response = await request(app)
      .get(`${API}/departments?page=1&pageSize=2`)
      .set('Cookie', cookie)
      .expect(200)

    expect(response.body.meta.pagination).toMatchObject({ page: 1, pageSize: 2 })
    expect(typeof response.body.meta.pagination.totalItems).toBe('number')
    expect(typeof response.body.meta.pagination.totalPages).toBe('number')
  })

  it.skipIf(!databaseAvailable)('bounds the page size at 100', async () => {
    const cookie = await ensureAuthCookie()
    const response = await request(app)
      .get(`${API}/departments?pageSize=500`)
      .set('Cookie', cookie)

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_FAILED')
    expect(JSON.stringify(response.body.error)).toMatch(/pageSize/)
  })

  it.skipIf(!databaseAvailable)('rejects an unsupported sort field', async () => {
    const cookie = await ensureAuthCookie()
    const response = await request(app)
      .get(`${API}/departments?sortBy=secretColumn`)
      .set('Cookie', cookie)

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_FAILED')
  })

  it.skipIf(!databaseAvailable)('rejects a non-numeric page', async () => {
    const cookie = await ensureAuthCookie()
    const response = await request(app).get(`${API}/departments?page=abc`).set('Cookie', cookie)

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_FAILED')
  })
})

describe('GET /api/v1/expense-categories', () => {
  it.skipIf(!databaseAvailable)('returns persisted categories from PostgreSQL', async () => {
    const cookie = await ensureAuthCookie()
    const response = await request(app)
      .get(`${API}/expense-categories`)
      .set('Cookie', cookie)
      .expect(200)

    expect(response.body.success).toBe(true)
    expect(response.body.data.length).toBeGreaterThan(0)
    expect(response.body.data[0]).toHaveProperty('code')
    expect(response.body.data[0]).toHaveProperty('name')
  })

  it.skipIf(!databaseAvailable)('applies the requested sort direction', async () => {
    const cookie = await ensureAuthCookie()
    const asc = await request(app)
      .get(`${API}/expense-categories?sortBy=name&sortOrder=asc`)
      .set('Cookie', cookie)

    const names = asc.body.data.map((c: { name: string }) => c.name)
    expect(names).toEqual([...names].sort())
  })
})

describe('database invariants', () => {
  it.skipIf(!databaseAvailable)('enforces the positive-amount constraint in PostgreSQL', async () => {
    const [department, category, user] = await Promise.all([
      prisma.department.findFirst(),
      prisma.expenseCategory.findFirst(),
      prisma.user.findFirst(),
    ])
    expect(department && category && user).toBeTruthy()

    await expect(
      prisma.voucher.create({
        data: {
          voucherNumber: `NEG-${Date.now()}`,
          voucherDate: new Date(),
          expenseDate: new Date(),
          departmentId: department!.id,
          expenseTitle: 'Negative amount probe',
          expenseCategoryId: category!.id,
          amount: '-1.00',
          createdById: user!.id,
        },
      }),
    ).rejects.toThrow()
  })

  it.skipIf(!databaseAvailable)('enforces voucher-number uniqueness in PostgreSQL', async () => {
    const existing = await prisma.voucher.findFirst({ select: { voucherNumber: true } })
    expect(existing).toBeTruthy()

    const [department, category, user] = await Promise.all([
      prisma.department.findFirst(),
      prisma.expenseCategory.findFirst(),
      prisma.user.findFirst(),
    ])

    await expect(
      prisma.voucher.create({
        data: {
          voucherNumber: existing!.voucherNumber,
          voucherDate: new Date(),
          expenseDate: new Date(),
          departmentId: department!.id,
          expenseTitle: 'Duplicate number probe',
          expenseCategoryId: category!.id,
          amount: '10.00',
          createdById: user!.id,
        },
      }),
    ).rejects.toThrow()
  })

  it.skipIf(!databaseAvailable)('allocates unique voucher numbers under concurrency', async () => {
    const { prisma: client } = await import('../../src/lib/prisma.js')
    const results = await Promise.all(
      Array.from({ length: 25 }, async () => {
        const rows = await client.$queryRaw<{ next_value: bigint }[]>`
          SELECT nextval('voucher_number_seq') AS next_value
        `
        return rows[0]!.next_value.toString()
      }),
    )

    expect(new Set(results).size).toBe(25)
  })

  it.skipIf(!databaseAvailable)('seeds all three business roles', async () => {
    const roles = await prisma.user.groupBy({ by: ['role'], _count: { _all: true } })
    const found = roles.map((r) => r.role).sort()

    expect(found).toContain('EMPLOYEE')
    expect(found).toContain('DIRECTOR')
    expect(found).toContain('ACCOUNTS')
  })

  /**
   * Phase 4 changed this assertion deliberately.
   *
   * The seed STILL never assigns a password: only `npm run auth:provision-demo`
   * can set a hash, and only for the four known demo identities. Automated test
   * fixtures (reserved @auth-test.pspl.test domain) also carry hashes while they
   * exist, which is expected.
   *
   * The real invariant: no account OUTSIDE those two controlled domains may ever
   * carry a hash, and no two accounts may share one.
   */
  it.skipIf(!databaseAvailable)(
    'only demo identities and test fixtures carry a password hash',
    async () => {
      const usersWithHash = await prisma.user.findMany({
        where: { passwordHash: { not: null } },
        select: { email: true, passwordHash: true },
      })

      const ALLOWED = ['@pspl.test', '@auth-test.pspl.test']

      for (const user of usersWithHash) {
        const allowed = ALLOWED.some((suffix) => user.email.endsWith(suffix))
        expect(
          allowed,
          `unexpected password hash on non-demo account ${user.email}`,
        ).toBe(true)
      }

      // Distinct bcrypt hashes: no shared/default password across accounts.
      const hashes = new Set(usersWithHash.map((u) => u.passwordHash!))
      expect(hashes.size).toBe(usersWithHash.length)
    },
  )

  it.skipIf(!databaseAvailable)(
    'seeded lifecycle vouchers respect CHECK invariants (Phase 9)',
    async () => {
      // Phase 9 seeds the full lifecycle (DRAFT/PENDING_APPROVAL/APPROVED/
      // REJECTED) with synthetic signatures. The old "only DRAFT" invariant is
      // intentionally replaced: every APPROVED voucher must carry a reviewer +
      // approvedAt, every REJECTED voucher a reviewer + reason, enforced by the
      // database CHECK constraints.
      const approvedWithoutReviewer = await prisma.voucher.count({
        where: { status: 'APPROVED', reviewedById: null },
      })
      expect(approvedWithoutReviewer).toBe(0)

      const rejectedWithoutReason = await prisma.voucher.count({
        where: { status: 'REJECTED', rejectionReason: null },
      })
      expect(rejectedWithoutReason).toBe(0)

      const approvedWithoutApprovedAt = await prisma.voucher.count({
        where: { status: 'APPROVED', approvedAt: null },
      })
      expect(approvedWithoutApprovedAt).toBe(0)

      const rejectedWithoutRejectedAt = await prisma.voucher.count({
        where: { status: 'REJECTED', rejectedAt: null },
      })
      expect(rejectedWithoutRejectedAt).toBe(0)

      // Decided vouchers carry exactly one EMPLOYEE + one DIRECTOR signature.
      const decided = await prisma.voucher.findMany({
        where: { status: { in: ['APPROVED', 'REJECTED'] } },
        select: { id: true, signatures: { select: { type: true } } },
      })
      for (const voucher of decided) {
        const types = voucher.signatures.map((s) => s.type).sort()
        expect(types).toEqual(['DIRECTOR', 'EMPLOYEE'])
      }
    },
  )

  it.skipIf(!databaseAvailable)('Phase 3 CHECK constraints are still present', async () => {
    const constraints = await prisma.$queryRaw<{ conname: string }[]>`
      SELECT conname FROM pg_constraint
      WHERE conname IN ('chk_vouchers_amount_positive','chk_vouchers_rejected_has_reason',
                        'chk_vouchers_approved_has_reviewer','chk_signatures_size_positive')
    `
    expect(constraints).toHaveLength(4)
  })
})