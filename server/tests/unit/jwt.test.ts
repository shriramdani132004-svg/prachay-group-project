import { describe, expect, it } from 'vitest'

/**
 * JWT / session unit tests.
 *
 * Uses a freshly generated ephemeral signing secret injected BEFORE the
 * application configuration is imported, so no reusable secret is ever committed.
 */
const ephemeralSecret = (await import('node:crypto')).randomBytes(48).toString('base64url')

process.env.JWT_SECRET = ephemeralSecret
process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'silent'

const { signSessionToken, verifySessionToken, generateCsrfToken } = await import(
  '../../src/services/jwt.service.js'
)

describe('session token signing and verification', () => {
  const claims = { sub: 'user-1', sid: 'session-1', role: 'EMPLOYEE' }

  it('signs and verifies a valid token', async () => {
    const token = await signSessionToken(claims)
    const verified = await verifySessionToken(token)

    expect(verified.sub).toBe('user-1')
    expect(verified.sid).toBe('session-1')
    expect(verified.role).toBe('EMPLOYEE')
  })

  it('rejects a tampered payload', async () => {
    const token = await signSessionToken(claims)
    const [header, payload, signature] = token.split('.')

    // A JWT we just signed always has exactly three segments; assert it rather
    // than casting, so a malformed token can never be silently accepted here.
    expect(header).toBeDefined()
    expect(payload).toBeDefined()
    expect(signature).toBeDefined()

    const decoded = JSON.parse(Buffer.from(payload as string, 'base64url').toString())
    decoded.sub = 'attacker-user'
    const forged = Buffer.from(JSON.stringify(decoded)).toString('base64url')

    await expect(
      verifySessionToken(`${header}.${forged}.${signature}`),
    ).rejects.toThrow()
  })

  it('rejects a token signed with a different key', async () => {
    const foreign = await import('jose')
    const otherKey = new TextEncoder().encode((await import('node:crypto')).randomBytes(48).toString('base64url'))

    const forged = await new foreign.SignJWT({ sid: 'session-1', role: 'DIRECTOR' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject('user-1')
      .setIssuer('pspl-voucher-api')
      .setAudience('pspl-voucher-portal')
      .setIssuedAt()
      .setExpirationTime('30m')
      .sign(otherKey)

    await expect(verifySessionToken(forged)).rejects.toThrow()
  })

  it('rejects the "none" algorithm', async () => {
    // alg=none with no signature must never be accepted.
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(
      JSON.stringify({
        sub: 'user-1',
        sid: 'session-1',
        role: 'DIRECTOR',
        iss: 'pspl-voucher-api',
        aud: 'pspl-voucher-portal',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString('base64url')

    await expect(verifySessionToken(`${header}.${payload}.`)).rejects.toThrow()
  })

  it('rejects a wrong issuer', async () => {
    const jose = await import('jose')
    const key = new TextEncoder().encode(ephemeralSecret)

    const token = await new jose.SignJWT({ sid: 's', role: 'EMPLOYEE' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u')
      .setIssuer('some-other-issuer')
      .setAudience('pspl-voucher-portal')
      .setExpirationTime('5m')
      .sign(key)

    await expect(verifySessionToken(token)).rejects.toThrow()
  })

  it('rejects a wrong audience', async () => {
    const jose = await import('jose')
    const key = new TextEncoder().encode(ephemeralSecret)

    const token = await new jose.SignJWT({ sid: 's', role: 'EMPLOYEE' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u')
      .setIssuer('pspl-voucher-api')
      .setAudience('some-other-audience')
      .setExpirationTime('5m')
      .sign(key)

    await expect(verifySessionToken(token)).rejects.toThrow()
  })

  it('rejects an expired token', async () => {
    const jose = await import('jose')
    const key = new TextEncoder().encode(ephemeralSecret)

    const token = await new jose.SignJWT({ sid: 's', role: 'EMPLOYEE' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u')
      .setIssuer('pspl-voucher-api')
      .setAudience('pspl-voucher-portal')
      // Issued long ago and already expired.
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(key)

    await expect(verifySessionToken(token)).rejects.toThrow()
  })

  it('rejects garbage input', async () => {
    await expect(verifySessionToken('not-a-jwt')).rejects.toThrow()
    await expect(verifySessionToken('')).rejects.toThrow()
    await expect(verifySessionToken('a.b.c')).rejects.toThrow()
  })

  it('rejects a token without a session id', async () => {
    const jose = await import('jose')
    const key = new TextEncoder().encode(ephemeralSecret)

    const token = await new jose.SignJWT({ role: 'EMPLOYEE' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u')
      .setIssuer('pspl-voucher-api')
      .setAudience('pspl-voucher-portal')
      .setExpirationTime('5m')
      .sign(key)

    await expect(verifySessionToken(token)).rejects.toThrow(/session id/i)
  })
})

describe('CSRF token generation', () => {
  it('produces a long random token', () => {
    const token = generateCsrfToken()
    expect(token.length).toBeGreaterThanOrEqual(32)
  })

  it('produces a different token each time', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateCsrfToken()))
    expect(tokens.size).toBe(50)
  })
})