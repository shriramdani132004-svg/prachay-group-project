import crypto from 'node:crypto'

/**
 * Integration test bootstrap.
 *
 * A FRESH random signing secret is generated for the test run and injected
 * BEFORE the application config module is imported anywhere. No reusable test
 * secret is ever committed to the repository.
 */
process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'silent'
process.env.JWT_SECRET = crypto.randomBytes(48).toString('base64url')
process.env.JWT_ISSUER = 'pspl-voucher-api'
process.env.JWT_AUDIENCE = 'pspl-voucher-portal'
process.env.CORS_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173'
// Deterministic limits: high enough that legitimate per-test logins are never
// throttled, low enough for the dedicated rate-limit test to trip quickly.
process.env.RATE_LIMIT_LOGIN_MAX = '1000'
process.env.RATE_LIMIT_API_MAX = '100000'
process.env.TRUST_PROXY_HOPS = '0'