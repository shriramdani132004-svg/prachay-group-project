import './setup-env.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import crypto from 'node:crypto'
import express from 'express'
import { createApp } from '../../src/app.js'
import { env } from '../../src/config/env.js'
import { prisma } from '../../src/lib/prisma.js'
import {
  cleanupFixtures,
  createFixtureUser,
  createFixtureVoucher,
  sessionCookieHeader,
  sessionCookieName,
  type FixtureUser,
} from './fixtures.js'

/**
 * AUTHENTICATION HTTP INTEGRATION TESTS.
 *
 * These exercise the REAL Express app against a REAL PostgreSQL database.
 * Credentials are proven through actual HTTP requests, not mocks.
 */
const app = createApp()
const API = '/api/v1'
const COOKIE = sessionCookieName()
const CSRF = 'x-csrf-token'

const employee: FixtureUser = { id: '', email: '', fullName: '', role: 'EMPLOYEE', password: '' }
const director: FixtureUser = { id: '', email: '', fullName: '', role: 'DIRECTOR', password: '' }
const accounts: FixtureUser = { id: '', email: '', fullName: '', role: 'ACCOUNTS', password: '' }

let employeeVoucherId = ''
let directorVoucherId = ''
const createdUserIds: string[] = []

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`

  Object.assign(employee, await createFixtureUser('EMPLOYEE', 'Fixture-Employee-Pass!42'))
  Object.assign(director, await createFixtureUser('DIRECTOR', 'Fixture-Director-Pass!42'))
  Object.assign(accounts, await createFixtureUser('ACCOUNTS', 'Fixture-Accounts-Pass!42'))

  createdUserIds.push(employee.id, director.id, accounts.id)

  const own = await createFixtureVoucher(employee.id, 'DRAFT')
  employeeVoucherId = own.id
  directorVoucherId = (await createFixtureVoucher(director.id, 'DRAFT')).id
})

afterAll(async () => {
  await cleanupFixtures(createdUserIds)
  await prisma.$disconnect()
})

async function login(user: FixtureUser) {
  const response = await request(app)
    .post(`${API}/auth/login`)
    .send({ email: user.email, password: user.password })
    .expect(200)

  return {
    cookie: sessionCookieHeader(response.headers['set-cookie']),
    csrfToken: response.body.data.csrfToken as string,
    body: response.body,
  }
}

// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/login', () => {
  it('succeeds with valid database-backed credentials', async () => {
    const response = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: employee.email, password: employee.password })
      .expect(200)

    expect(response.body.success).toBe(true)
    expect(response.body.data.user.email).toBe(employee.email)
    expect(response.body.data.user.role).toBe('EMPLOYEE')
    expect(typeof response.body.data.csrfToken).toBe('string')
  })

  it('sets an HttpOnly cookie with correct SameSite and Path', async () => {
    const response = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: employee.email, password: employee.password })
      .expect(200)

    const cookies = response.headers['set-cookie'] as unknown as string[]
    const session = cookies.find((c) => c.startsWith(COOKIE))!

    expect(session).toBeDefined()
    expect(session.toLowerCase()).toContain('httponly')
    expect(session.toLowerCase()).toContain('samesite=lax')
    expect(session.toLowerCase()).toContain('path=/')
  })

  it('is not Secure for local HTTP development/test', async () => {
    const response = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: employee.email, password: employee.password })

    const session = (response.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith(COOKIE),
    )!

    // env.cookieSecure is false outside production; assert the flag is consistent.
    expect(session.toLowerCase().includes('secure')).toBe(env.cookieSecure)
  })

  it('never returns the JWT in the response body', async () => {
    const response = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: employee.email, password: employee.password })

    const body = JSON.stringify(response.body)
    expect(body).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/) // JWT header
    expect(response.body.data).not.toHaveProperty('token')
    expect(response.body.data).not.toHaveProperty('jwt')
  })

  it('never returns a password hash', async () => {
    const response = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: employee.email, password: employee.password })

    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash/i)
    expect(JSON.stringify(response.body)).not.toMatch(/\$2[aby]\$/)
  })

  it('returns a generic 401 for a wrong password', async () => {
    const response = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: employee.email, password: 'Wrong-Password-999!' })
      .expect(401)

    expect(response.body.error.code).toBe('UNAUTHORIZED')
    expect(response.body.error.message).toBe('Invalid email or password.')
  })

  it('returns the IDENTICAL generic error for an unknown email', async () => {
    const response = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: 'nobody.here@pspl.test', password: 'Whatever-Password!9' })
      .expect(401)

    // Byte-identical to the wrong-password response: no account enumeration.
    expect(response.body.error.message).toBe('Invalid email or password.')
    expect(response.body.error.code).toBe('UNAUTHORIZED')
  })

  it('refuses an unprovisioned account (no password hash)', async () => {
    // A Phase 3 seeded fixture intentionally has passwordHash = NULL.
    const seeded = await prisma.user.findFirst({
      where: { email: { endsWith: '@pspl.test' } },
      select: { email: true },
    })
    expect(seeded).toBeTruthy()

    const response = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: seeded!.email, password: 'Any-Password-123!' })
      .expect(401)

    expect(response.body.error.message).toBe('Invalid email or password.')
  })

  it('refuses a deactivated account', async () => {
    const temp = await createFixtureUser('EMPLOYEE', 'Deactivated-Pass!42')
    createdUserIds.push(temp.id)

    await prisma.user.update({ where: { id: temp.id }, data: { isActive: false } })

    const response = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: temp.email, password: temp.password })
      .expect(401)

    expect(response.body.error.message).toBe('Invalid email or password.')
  })

  it('rejects a malformed payload', async () => {
    await request(app).post(`${API}/auth/login`).send({}).expect(400)
    await request(app).post(`${API}/auth/login`).send({ email: 'not-an-email' }).expect(400)
  })

  it('rejects extra fields so role cannot be smuggled in', async () => {
    const response = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: employee.email, password: employee.password, role: 'DIRECTOR' })
      .expect(400)

    expect(response.body.error.code).toBe('VALIDATION_FAILED')
  })

  it('rejects an untrusted Origin', async () => {
    await request(app)
      .post(`${API}/auth/login`)
      .set('Origin', 'https://evil.example.com')
      .send({ email: employee.email, password: employee.password })
      .expect(403)
  })

  it('accepts a trusted configured Origin', async () => {
    await request(app)
      .post(`${API}/auth/login`)
      .set('Origin', 'http://localhost:5173')
      .send({ email: employee.email, password: employee.password })
      .expect(200)
  })
})

// ---------------------------------------------------------------------------
describe('GET /api/v1/auth/me', () => {
  it('returns the sanitized user and CSRF token for a valid session', async () => {
    const { cookie, csrfToken } = await login(employee)

    const response = await request(app).get(`${API}/auth/me`).set('Cookie', cookie).expect(200)

    expect(response.body.data.user.id).toBe(employee.id)
    expect(response.body.data.user.role).toBe('EMPLOYEE')
    expect(response.body.data.csrfToken).toBe(csrfToken)
    expect(response.body.data.user).not.toHaveProperty('passwordHash')
  })

  it('rejects an anonymous request', async () => {
    await request(app).get(`${API}/auth/me`).expect(401)
  })

  it('rejects a garbage cookie', async () => {
    await request(app).get(`${API}/auth/me`).set('Cookie', `${COOKIE}=garbage`).expect(401)
  })

  it('rejects a token signed with a foreign key', async () => {
    const jose = await import('jose')
    const forged = await new jose.SignJWT({ sid: 'x', role: 'DIRECTOR' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(employee.id)
      .setIssuer(env.JWT_ISSUER)
      .setAudience(env.JWT_AUDIENCE)
      .setExpirationTime('30m')
      .sign(new TextEncoder().encode(crypto.randomBytes(48).toString('base64url')))

    await request(app).get(`${API}/auth/me`).set('Cookie', `${COOKIE}=${forged}`).expect(401)
  })

  it('rejects an expired token signed with the REAL secret', async () => {
    const jose = await import('jose')
    const now = Math.floor(Date.now() / 1000)

    // Correct signature and claims, but already expired: expiry must be
    // enforced even for a token the server itself could have issued.
    const expired = await new jose.SignJWT({ sid: crypto.randomUUID(), role: 'EMPLOYEE' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(employee.id)
      .setIssuer(env.JWT_ISSUER)
      .setAudience(env.JWT_AUDIENCE)
      .setIssuedAt(now - 7200)
      .setExpirationTime(now - 3600)
      .sign(new TextEncoder().encode(env.JWT_SECRET))

    const response = await request(app)
      .get(`${API}/auth/me`)
      .set('Cookie', `${COOKIE}=${expired}`)
      .expect(401)

    expect(response.body.error.code).toBe('UNAUTHORIZED')
  })

  it('rejects a correctly signed token with the wrong issuer', async () => {
    const jose = await import('jose')
    const now = Math.floor(Date.now() / 1000)

    const wrongIssuer = await new jose.SignJWT({ sid: crypto.randomUUID(), role: 'EMPLOYEE' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(employee.id)
      .setIssuer('not-the-pspl-api')
      .setAudience(env.JWT_AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + 1800)
      .sign(new TextEncoder().encode(env.JWT_SECRET))

    await request(app).get(`${API}/auth/me`).set('Cookie', `${COOKIE}=${wrongIssuer}`).expect(401)
  })
})

// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/logout', () => {
  it('revokes the server-side session and clears the cookie', async () => {
    const { cookie, csrfToken } = await login(employee)

    const response = await request(app)
      .post(`${API}/auth/logout`)
      .set('Cookie', cookie)
      .set(CSRF, csrfToken)
      .expect(200)

    const cleared = (response.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith(COOKIE),
    )!
    expect(cleared).toBeTruthy()

    // The revoked session must be rejected even with the same cookie value.
    await request(app).get(`${API}/auth/me`).set('Cookie', cookie).expect(401)
  })

  it('rejects logout without a CSRF token', async () => {
    const { cookie } = await login(employee)

    const response = await request(app)
      .post(`${API}/auth/logout`)
      .set('Cookie', cookie)
      .expect(403)

    expect(response.body.error.code).toBe('FORBIDDEN')

    // The session must NOT have been revoked by a CSRF-invalid request.
    await request(app).get(`${API}/auth/me`).set('Cookie', cookie).expect(200)
  })

  it('rejects logout with a wrong CSRF token without revoking the session', async () => {
    const { cookie } = await login(employee)

    await request(app)
      .post(`${API}/auth/logout`)
      .set('Cookie', cookie)
      .set(CSRF, 'not-the-right-token')
      .expect(403)

    await request(app).get(`${API}/auth/me`).set('Cookie', cookie).expect(200)
  })

  it('rejects an anonymous logout', async () => {
    await request(app).post(`${API}/auth/logout`).expect(401)
  })

  it('is safe to repeat after the session ended', async () => {
    const { cookie, csrfToken } = await login(employee)

    await request(app)
      .post(`${API}/auth/logout`)
      .set('Cookie', cookie)
      .set(CSRF, csrfToken)
      .expect(200)

    // Repeating with the revoked cookie must not error out.
    await request(app)
      .post(`${API}/auth/logout`)
      .set('Cookie', cookie)
      .set(CSRF, csrfToken)
      .expect(401)
  })
})

// ---------------------------------------------------------------------------
describe('anonymous access is denied', () => {
  it('cannot read departments', async () => {
    await request(app).get(`${API}/departments`).expect(401)
  })

  it('cannot read expense categories', async () => {
    await request(app).get(`${API}/expense-categories`).expect(401)
  })

  it('cannot list vouchers', async () => {
    await request(app).get(`${API}/vouchers`).expect(401)
  })

  it('cannot read a voucher by id', async () => {
    await request(app).get(`${API}/vouchers/${employeeVoucherId}`).expect(401)
  })

  it('cannot edit a voucher', async () => {
    await request(app)
      .patch(`${API}/vouchers/${employeeVoucherId}`)
      .send({ expenseTitle: 'hacked' })
      .expect(401)
  })

  it('cannot approve a voucher', async () => {
    await request(app).post(`${API}/vouchers/${employeeVoucherId}/approve`).expect(401)
  })

  it('cannot access signatures', async () => {
    await request(app).get(`${API}/signatures/${crypto.randomUUID()}`).expect(401)
  })

  it('leaves health endpoints public and safe', async () => {
    const live = await request(app).get(`${API}/health/live`).expect(200)
    expect(live.body.data.status).toBe('alive')
    expect(JSON.stringify(live.body)).not.toMatch(/password|postgres:\/\//i)
  })
})

// ---------------------------------------------------------------------------
describe('role and ownership boundaries', () => {
  it('lets an employee read their own voucher', async () => {
    const { cookie } = await login(employee)
    await request(app).get(`${API}/vouchers/${employeeVoucherId}`).set('Cookie', cookie).expect(200)
  })

  it("blocks an employee from reading ANOTHER employee's voucher (IDOR)", async () => {
    const { cookie } = await login(employee)

    const response = await request(app)
      .get(`${API}/vouchers/${directorVoucherId}`)
      .set('Cookie', cookie)
      .expect(404)

    // 404, not 403: the existence of the record must not be disclosed.
    expect(response.body.error.code).toBe('NOT_FOUND')
  })

  it("blocks an employee from editing ANOTHER employee's voucher", async () => {
    const { cookie, csrfToken } = await login(employee)

    await request(app)
      .patch(`${API}/vouchers/${directorVoucherId}`)
      .set('Cookie', cookie)
      .set(CSRF, csrfToken)
      .send({ expenseTitle: 'hijacked' })
      .expect(404)
  })

  it('allows a director to read an organization-wide voucher', async () => {
    const { cookie } = await login(director)
    await request(app).get(`${API}/vouchers/${employeeVoucherId}`).set('Cookie', cookie).expect(200)
  })

  it('lets an employee edit their own DRAFT voucher (real update)', async () => {
    const { cookie, csrfToken } = await login(employee)

    // Phase 5 implements the update: the authorized PATCH now persists.
    const response = await request(app)
      .patch(`${API}/vouchers/${employeeVoucherId}`)
      .set('Cookie', cookie)
      .set(CSRF, csrfToken)
      .send({ expenseTitle: 'A new title' })
      .expect(200)

    expect(response.body.success).toBe(true)
    expect(response.body.data.expenseTitle).toBe('A new title')

    const after = await prisma.voucher.findUniqueOrThrow({
      where: { id: employeeVoucherId },
      select: { expenseTitle: true, status: true },
    })
    expect(after.expenseTitle).toBe('A new title')
    expect(after.status).toBe('DRAFT')
  })

  it('rejects editing a non-DRAFT voucher with 409', async () => {
    const submitted = await createFixtureVoucher(employee.id, 'PENDING_APPROVAL')
    const { cookie, csrfToken } = await login(employee)

    const response = await request(app)
      .patch(`${API}/vouchers/${submitted.id}`)
      .set('Cookie', cookie)
      .set(CSRF, csrfToken)
      .send({ expenseTitle: 'too late' })
      .expect(409)

    expect(response.body.error.code).toBe('INVALID_STATE_TRANSITION')
  })

  it('keeps Accounts read-only even for its own records', async () => {
    const own = await createFixtureVoucher(accounts.id, 'DRAFT')
    const { cookie, csrfToken } = await login(accounts)

    // Accounts cannot edit: the record is found but the policy forbids it.
    await request(app)
      .patch(`${API}/vouchers/${own.id}`)
      .set('Cookie', cookie)
      .set(CSRF, csrfToken)
      .send({ expenseTitle: 'nope' })
      .expect(404)
  })

  it('forbids an employee from approving', async () => {
    const { cookie, csrfToken } = await login(employee)

    const response = await request(app)
      .post(`${API}/vouchers/${employeeVoucherId}/approve`)
      .set('Cookie', cookie)
      .set(CSRF, csrfToken)
      .expect(403)

    expect(response.body.error.code).toBe('FORBIDDEN')
  })

  it('forbids Accounts from approving', async () => {
    const { cookie, csrfToken } = await login(accounts)

    await request(app)
      .post(`${API}/vouchers/${employeeVoucherId}/approve`)
      .set('Cookie', cookie)
      .set(CSRF, csrfToken)
      .expect(403)
  })

  it('forbids an employee from rejecting', async () => {
    const { cookie, csrfToken } = await login(employee)

    await request(app)
      .post(`${API}/vouchers/${employeeVoucherId}/reject`)
      .set('Cookie', cookie)
      .set(CSRF, csrfToken)
      .send({ reason: 'Because I said so, honestly.' })
      .expect(403)
  })

  it('lets the DIRECTOR reach the approve boundary (409, no mutation)', async () => {
    const before = await prisma.voucher.findUniqueOrThrow({
      where: { id: employeeVoucherId },
      select: { status: true },
    })

    const { cookie, csrfToken } = await login(director)

    // The fixture voucher is still DRAFT, so approval correctly refuses
    // with INVALID_STATE_TRANSITION (only PENDING_APPROVAL is decidable).
    const response = await request(app)
      .post(`${API}/vouchers/${employeeVoucherId}/approve`)
      .set('Cookie', cookie)
      .set(CSRF, csrfToken)
      .expect(409)

    expect(response.body.error.code).toBe('INVALID_STATE_TRANSITION')

    // Critically: no fabricated approval occurred.
    const after = await prisma.voucher.findUniqueOrThrow({
      where: { id: employeeVoucherId },
      select: { status: true },
    })
    expect(after.status).toBe(before.status)
  })

  it('rejects mass-assignment of owner/role/status fields', async () => {
    const { cookie, csrfToken } = await login(employee)

    await request(app)
      .patch(`${API}/vouchers/${employeeVoucherId}`)
      .set('Cookie', cookie)
      .set(CSRF, csrfToken)
      .send({ role: 'DIRECTOR', createdById: director.id, status: 'APPROVED' })
      .expect(400)
  })

  it('scopes an employee voucher list to their own records', async () => {
    const { cookie } = await login(employee)
    const response = await request(app).get(`${API}/vouchers`).set('Cookie', cookie).expect(200)

    expect(response.body.data.scope).toBe('own')
  })

  it('gives a director an organization-wide scope', async () => {
    const { cookie } = await login(director)
    const response = await request(app).get(`${API}/vouchers`).set('Cookie', cookie).expect(200)

    expect(response.body.data.scope).toBe('organization')
  })
})

// ---------------------------------------------------------------------------
describe('CSRF protection', () => {
  it('rejects a state-changing request without a CSRF token', async () => {
    const { cookie } = await login(employee)

    await request(app)
      .patch(`${API}/vouchers/${employeeVoucherId}`)
      .set('Cookie', cookie)
      .send({ expenseTitle: 'no token' })
      .expect(403)
  })

  it('rejects a state-changing request with a wrong CSRF token', async () => {
    const { cookie } = await login(employee)

    await request(app)
      .patch(`${API}/vouchers/${employeeVoucherId}`)
      .set('Cookie', cookie)
      .set(CSRF, 'wrong-token-value')
      .send({ expenseTitle: 'bad token' })
      .expect(403)
  })

  it('does NOT require CSRF for safe GET requests', async () => {
    const { cookie } = await login(employee)
    await request(app).get(`${API}/vouchers/${employeeVoucherId}`).set('Cookie', cookie).expect(200)
  })

  it('requires CSRF even for an authorized director mutation', async () => {
    const { cookie } = await login(director)

    await request(app)
      .post(`${API}/vouchers/${employeeVoucherId}/approve`)
      .set('Cookie', cookie)
      .expect(403)
  })
})

// ---------------------------------------------------------------------------
describe('session revocation', () => {
  it('rejects a previously valid JWT after its session is revoked', async () => {
    const { cookie, csrfToken } = await login(director)

    // Works before logout.
    await request(app).get(`${API}/auth/me`).set('Cookie', cookie).expect(200)

    await request(app)
      .post(`${API}/auth/logout`)
      .set('Cookie', cookie)
      .set(CSRF, csrfToken)
      .expect(200)

    // The same token value must now be rejected.
    await request(app).get(`${API}/auth/me`).set('Cookie', cookie).expect(401)
  })

  it('rejects a session whose user was deactivated', async () => {
    const temp = await createFixtureUser('EMPLOYEE', 'Soon-Deactivated!42')
    createdUserIds.push(temp.id)

    const { cookie } = await login(temp)
    await request(app).get(`${API}/auth/me`).set('Cookie', cookie).expect(200)

    await prisma.user.update({ where: { id: temp.id }, data: { isActive: false } })

    await request(app).get(`${API}/auth/me`).set('Cookie', cookie).expect(401)
  })

  it('stores an auditable session row linked to the user', async () => {
    const { cookie } = await login(accounts)

    const session = await prisma.authSession.findFirst({
      where: { userId: accounts.id, revokedAt: null },
      select: { id: true, userId: true, expiresAt: true, csrfToken: true },
    })

    expect(session).toBeTruthy()
    expect(session!.userId).toBe(accounts.id)
    expect(session!.expiresAt.getTime()).toBeGreaterThan(Date.now())

    void cookie
  })
})

// ---------------------------------------------------------------------------
describe('rate limiting', () => {
  it('throttles login attempts and returns a consistent 429', async () => {
    // A dedicated limiter with a low threshold, so this is deterministic and
    // does not depend on (or exhaust) the shared limiter's budget.
    const { createRateLimiter } = await import('../../src/middleware/rate-limit.js')

    const limitedApp = express()
    limitedApp.use(express.json())
    limitedApp.post(
      `${API}/auth/login`,
      createRateLimiter(3, 60_000),
      (_req, res) => {
        res.status(200).json({ success: true, data: { ok: true } })
      },
    )

    const codes: number[] = []
    for (let i = 0; i < 5; i++) {
      const response = await request(limitedApp)
        .post(`${API}/auth/login`)
        .send({ email: `x${i}@pspl.test`, password: 'nope' })
      codes.push(response.status)
    }

    // First 3 succeed, the rest are throttled.
    expect(codes.slice(0, 3)).toEqual([200, 200, 200])
    expect(codes.slice(3).every((c) => c === 429)).toBe(true)

    const throttled = await request(limitedApp)
      .post(`${API}/auth/login`)
      .send({ email: 'again@pspl.test', password: 'nope' })

    expect(throttled.status).toBe(429)
    expect(throttled.body.success).toBe(false)
    expect(throttled.body.error.code).toBe('RATE_LIMITED')
  })

  it('sets standard rate-limit headers', async () => {
    const { createRateLimiter } = await import('../../src/middleware/rate-limit.js')

    const limitedApp = express()
    limitedApp.get('/probe', createRateLimiter(5, 60_000), (_req, res) => {
      res.status(200).json({ success: true })
    })

    const response = await request(limitedApp).get('/probe')

    expect(
      response.headers['ratelimit'] !== undefined ||
        response.headers['ratelimit-policy'] !== undefined,
    ).toBe(true)
  })

  it('does not throttle legitimate logins below the shared threshold', async () => {
    const { cookie } = await login(employee)
    expect(cookie).toBeTruthy()

    const { cookie: second } = await login(employee)
    expect(second).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
describe('sensitive data never leaks', () => {
  it('never exposes password hashes through any authenticated response', async () => {
    const { cookie, csrfToken } = await login(director)

    const paths = [
      `${API}/auth/me`,
      `${API}/vouchers`,
      `${API}/vouchers/${employeeVoucherId}`,
      `${API}/departments`,
      `${API}/expense-categories`,
    ]

    for (const path of paths) {
      const response = await request(app).get(path).set('Cookie', cookie)
      const body = JSON.stringify(response.body)

      expect(body, `path ${path}`).not.toMatch(/passwordHash/i)
      expect(body, `path ${path}`).not.toMatch(/\$2[aby]\$/)
      expect(body, `path ${path}`).not.toMatch(/DATABASE_URL|postgresql:\/\//i)
    }

    void csrfToken
  })
})