import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'

/**
 * API surface tests that do NOT require a database.
 * Uses the real Express app via Supertest; no port is bound.
 */
const app = createApp()

const API = '/api/v1'

describe('GET /', () => {
  it('reports service metadata', async () => {
    const response = await request(app).get('/').expect(200)

    expect(response.body.success).toBe(true)
    expect(response.body.data.service).toBe('pspl-voucher-api')
    expect(response.body.data.apiPrefix).toBe(API)
  })

  it('returns a standard envelope with a request id', async () => {
    const response = await request(app).get('/')

    expect(response.body.meta).toHaveProperty('timestamp')
    expect(response.body.meta.requestId).toBeTruthy()
    expect(response.headers['x-request-id']).toBe(response.body.meta.requestId)
  })
})

describe('security headers', () => {
  it('sets helmet security headers', async () => {
    const response = await request(app).get('/')

    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['content-security-policy']).toBeDefined()
    expect(response.headers['x-powered-by']).toBeUndefined()
  })

  it('echoes a supplied x-request-id', async () => {
    const response = await request(app).get('/').set('x-request-id', 'trace-abc-123')

    expect(response.headers['x-request-id']).toBe('trace-abc-123')
    expect(response.body.meta.requestId).toBe('trace-abc-123')
  })

  it('ignores a hostile inbound x-request-id', async () => {
    const response = await request(app)
      .get('/')
      .set('x-request-id', 'bad value with spaces and <script>')

    expect(response.headers['x-request-id']).not.toContain('script')
  })
})

describe('CORS', () => {
  it('allows the configured frontend origin', async () => {
    const response = await request(app).get('/').set('Origin', 'http://localhost:5173')
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173')
  })

  it('does not allow an unlisted origin', async () => {
    const response = await request(app).get('/').set('Origin', 'https://evil.example.com')
    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })
})

describe('unknown routes', () => {
  it('returns a structured 404 rather than HTML', async () => {
    const response = await request(app).get(`${API}/does-not-exist`).expect(404)

    expect(response.type).toBe('application/json')
    expect(response.body.success).toBe(false)
    expect(response.body.error.code).toBe('NOT_FOUND')
    expect(response.body.meta.requestId).toBeTruthy()
  })

  it('never leaks a stack trace', async () => {
    const response = await request(app).get(`${API}/does-not-exist`)

    expect(JSON.stringify(response.body)).not.toMatch(/at .*\.ts:\d+/)
    expect(response.body.error).not.toHaveProperty('stack')
  })
})

describe('malformed requests', () => {
  it('rejects invalid JSON with a 400 envelope', async () => {
    const response = await request(app)
      .post(`${API}/vouchers`)
      .set('Content-Type', 'application/json')
      .send('{ this is not json')

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
    expect(response.body.error.code).toBe('BAD_REQUEST')
  })

  it('rejects an oversized JSON payload with 413', async () => {
    const response = await request(app)
      .post(`${API}/vouchers`)
      .set('Content-Type', 'application/json')
      .send({ padding: 'x'.repeat(2 * 1024 * 1024) })

    expect(response.status).toBe(413)
    expect(response.body.success).toBe(false)
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE')
  })
})

describe('phase boundaries', () => {
  /**
   * Phase 4 replaced the blanket "fails closed" guards with real routes.
   *
   * The invariant is UNCHANGED and stronger: an anonymous caller must never
   * reach business data or mutate anything. Routes that do not exist yet (no
   * POST/PUT/DELETE /:id in Phase 4) legitimately 404; the point is that
   * nothing is reachable anonymously either way.
   */
  it('denies anonymous reads of every implemented protected route', async () => {
    const protectedPaths = [
      `${API}/departments`,
      `${API}/expense-categories`,
      `${API}/vouchers`,
      `${API}/vouchers/3f8c1d2e-4a5b-4c6d-8e9f-0a1b2c3d4e5f`,
      `${API}/signatures/3f8c1d2e-4a5b-4c6d-8e9f-0a1b2c3d4e5f`,
    ]

    for (const path of protectedPaths) {
      const response = await request(app).get(path)
      expect(response.status, `anonymous GET ${path} must be denied`).toBe(401)
      expect(response.body.success).toBe(false)
    }
  })

  it('denies anonymous mutations of every implemented protected route', async () => {
    const cases: [string, string][] = [
      ['patch', `${API}/vouchers/3f8c1d2e-4a5b-4c6d-8e9f-0a1b2c3d4e5f`],
      ['post', `${API}/vouchers/3f8c1d2e-4a5b-4c6d-8e9f-0a1b2c3d4e5f/approve`],
      ['post', `${API}/vouchers/3f8c1d2e-4a5b-4c6d-8e9f-0a1b2c3d4e5f/reject`],
      ['post', `${API}/auth/logout`],
      ['post', `${API}/signatures/upload`],
    ]

    for (const [method, path] of cases) {
      const response = await request(app)[method as 'patch' | 'post'](path)
      expect(response.status, `anonymous ${method.toUpperCase()} ${path} must be denied`).toBe(401)
    }
  })

  it('does not expose signature retrieval anonymously', async () => {
    const response = await request(app).get(`${API}/signatures/3f8c1d2e-4a5b-4c6d-8e9f-0a1b2c3d4e5f`)
    expect(response.status).toBeGreaterThanOrEqual(401)
  })
})

describe('sensitive data protection', () => {
  it('never returns password hashes or user records', async () => {
    const paths = ['/', `${API}/health/live`, `${API}/departments?pageSize=1`, `${API}/nope`]

    for (const path of paths) {
      const response = await request(app).get(path)
      const body = JSON.stringify(response.body)

      expect(body).not.toMatch(/passwordHash/i)
      expect(body).not.toMatch(/\$2[aby]\$/) // bcrypt hash prefix
      expect(body).not.toMatch(/DATABASE_URL|postgresql:\/\//i)
    }
  })
})