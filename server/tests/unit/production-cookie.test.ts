import { afterEach, describe, expect, it, vi } from 'vitest'
import crypto from 'node:crypto'

/**
 * PRODUCTION COOKIE CONFIGURATION TESTS.
 *
 * These load the REAL configuration module and the REAL shared cookie helpers
 * (`src/modules/auth/session-cookie.ts`) with a production environment injected
 * into this test process before import, so the genuine `__Host-` policy is
 * exercised rather than a re-implementation. No .env file is modified, and no
 * secret, token or connection string is ever printed.
 */

const PRODUCTION_SECRET = crypto.randomBytes(48).toString('base64url')

process.env.NODE_ENV = 'production'
process.env.LOG_LEVEL = 'silent'
process.env.JWT_SECRET = PRODUCTION_SECRET
process.env.JWT_ISSUER = 'pspl-voucher-api'
process.env.JWT_AUDIENCE = 'pspl-voucher-portal'
process.env.JWT_TTL_SECONDS = '1800'
process.env.DEMO_AUTH_ENABLED = 'false'
process.env.CORS_ORIGINS = 'https://portal.example.test'
// Only used by the schema; never dialed by these tests.
process.env.DATABASE_URL ??= 'postgresql://cookie-test.invalid:5432/cookie_test'

const { env } = await import('../../src/config/env.js')
const {
  buildSessionCookieOptions,
  buildClearSessionCookieOptions,
  setSessionCookie,
  clearSessionCookie,
} = await import('../../src/modules/auth/session-cookie.js')

type CookieCall = { name: string; value: string; options: Record<string, unknown> }

/** Minimal Response double capturing cookie()/clearCookie() invocations. */
function captureResponse() {
  const setCalls: CookieCall[] = []
  const clearCalls: CookieCall[] = []

  const res = {
    cookie(name: string, value: string, options: Record<string, unknown>) {
      setCalls.push({ name, value, options })
      return res
    },
    clearCookie(name: string, options: Record<string, unknown>) {
      clearCalls.push({ name, value: '', options })
      return res
    },
  }

  return {
    res: res as unknown as Parameters<typeof setSessionCookie>[0],
    setCalls,
    clearCalls,
  }
}

/** Freshly re-imports config + cookie helpers under the given overrides. */
async function loadWith(overrides: Record<string, string>) {
  vi.resetModules()
  for (const [key, value] of Object.entries(overrides)) vi.stubEnv(key, value)

  const [{ env: loadedEnv }, cookie] = await Promise.all([
    import('../../src/config/env.js'),
    import('../../src/modules/auth/session-cookie.js'),
  ])

  vi.unstubAllEnvs()
  return { env: loadedEnv, cookie }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

// ---------------------------------------------------------------------------
describe('production session cookie policy (real shared helpers)', () => {
  it('is exercising a production configuration', () => {
    expect(env.isProduction).toBe(true)
  })

  it('names the cookie with the __Host- prefix', () => {
    expect(env.sessionCookieName).toBe('__Host-pspl_session')
  })

  it('enables HttpOnly so the JWT is unreachable from JavaScript', () => {
    const options = buildSessionCookieOptions(new Date())

    expect(options.httpOnly).toBe(true)
  })

  it('enables Secure, as required for HTTPS deployments and the __Host- prefix', () => {
    expect(env.cookieSecure).toBe(true)

    const options = buildSessionCookieOptions(new Date())
    expect(options.secure).toBe(true)
  })

  it('uses SameSite=Lax and Path=/', () => {
    const options = buildSessionCookieOptions(new Date())

    expect(options.sameSite).toBe('lax')
    expect(options.path).toBe('/')
  })

  it('sets no Domain attribute, keeping the cookie host-only', () => {
    const options = buildSessionCookieOptions(new Date()) as Record<string, unknown>

    expect(options).not.toHaveProperty('domain')
    expect(options.domain).toBeUndefined()
  })

  it('carries the session expiry so the cookie lifetime matches authentication', () => {
    const expiresAt = new Date(Date.now() + 1_800_000)
    const options = buildSessionCookieOptions(expiresAt)

    expect(options.expires).toBe(expiresAt)
    // The expiry comes from the session row, whose lifetime is JWT_TTL_SECONDS.
    expect(env.JWT_TTL_SECONDS).toBe(1800)
  })

  it('signs tokens whose lifetime equals JWT_TTL_SECONDS', async () => {
    const { signSessionToken } = await import('../../src/services/jwt.service.js')

    const token = await signSessionToken({
      sub: crypto.randomUUID(),
      sid: crypto.randomUUID(),
      role: 'EMPLOYEE',
    })

    const [header, payload] = token.split('.')
    expect(header).toBeDefined()
    expect(payload).toBeDefined()

    const claims = JSON.parse(Buffer.from(payload as string, 'base64url').toString()) as {
      iat?: number
      exp?: number
    }

    expect(typeof claims.iat).toBe('number')
    expect(typeof claims.exp).toBe('number')
    expect((claims.exp as number) - (claims.iat as number)).toBe(env.JWT_TTL_SECONDS)
  })

  it('writes the token to the __Host- cookie and nowhere else', () => {
    const token = crypto.randomBytes(32).toString('base64url')
    const { res, setCalls } = captureResponse()

    setSessionCookie(res, token, new Date(Date.now() + 1_800_000))

    expect(setCalls).toHaveLength(1)
    expect(setCalls[0]!.name).toBe('__Host-pspl_session')
    expect(setCalls[0]!.value).toBe(token)
    expect(setCalls[0]!.options.httpOnly).toBe(true)
    expect(setCalls[0]!.options.secure).toBe(true)
  })

  it('clears the cookie with the same compatible attributes', () => {
    const { res, clearCalls } = captureResponse()

    clearSessionCookie(res)

    expect(clearCalls).toHaveLength(1)
    expect(clearCalls[0]!.name).toBe('__Host-pspl_session')
    expect(clearCalls[0]!.options.httpOnly).toBe(true)
    expect(clearCalls[0]!.options.secure).toBe(true)
    expect(clearCalls[0]!.options.sameSite).toBe('lax')
    expect(clearCalls[0]!.options.path).toBe('/')
    expect(clearCalls[0]!.options).not.toHaveProperty('domain')
  })

  it('clear options match set options except for the expiry', () => {
    const setOptions = buildSessionCookieOptions(new Date()) as Record<string, unknown>
    const clearOptions = buildClearSessionCookieOptions() as Record<string, unknown>

    for (const key of Object.keys(clearOptions)) {
      expect(clearOptions[key], `attribute ${key} must match`).toEqual(setOptions[key])
    }
    expect(clearOptions).not.toHaveProperty('expires')
  })
})

// ---------------------------------------------------------------------------
describe('production startup guards', () => {
  it('refuses to start in production with a placeholder JWT secret', async () => {
    vi.resetModules()
    vi.stubEnv('JWT_SECRET', 'change-me-please-0123456789abcdefgh')

    await expect(import('../../src/config/env.js')).rejects.toThrow(/placeholder/i)
  })

  it('refuses to start in production with demo authentication enabled', async () => {
    vi.resetModules()
    vi.stubEnv('DEMO_AUTH_ENABLED', 'true')

    await expect(import('../../src/config/env.js')).rejects.toThrow(/DEMO_AUTH_ENABLED/)
  })
})

// ---------------------------------------------------------------------------
describe('development HTTP setup remains functional', () => {
  it('uses an unprefixed cookie without Secure for local HTTP', async () => {
    const { env: devEnv, cookie } = await loadWith({
      NODE_ENV: 'development',
      JWT_SECRET: crypto.randomBytes(48).toString('base64url'),
      DEMO_AUTH_ENABLED: 'false',
    })

    expect(devEnv.isDevelopment).toBe(true)
    expect(devEnv.sessionCookieName).toBe('pspl_session')
    expect(devEnv.cookieSecure).toBe(false)

    const options = cookie.buildSessionCookieOptions(new Date())
    expect(options.httpOnly).toBe(true)
    expect(options.secure).toBe(false)
    expect(options.sameSite).toBe('lax')
    expect(options.path).toBe('/')
    expect(options).not.toHaveProperty('domain')
  })
})
