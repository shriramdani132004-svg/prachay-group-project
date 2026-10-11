import { describe, expect, it } from 'vitest'
import crypto from 'node:crypto'
import { Writable } from 'node:stream'
import pino from 'pino'

process.env.NODE_ENV ??= 'test'
process.env.LOG_LEVEL = 'info'
process.env.JWT_SECRET ??= crypto.randomBytes(48).toString('base64url')
process.env.DATABASE_URL ??= 'postgresql://logger-test.invalid:5432/logger_test'

const { logger } = await import('../../src/utils/logger.js')

/**
 * LOG REDACTION TESTS.
 *
 * Captures the REAL application logger's output by temporarily swapping its
 * destination stream, then asserts that credential and session material is
 * censored even when a caller passes it by mistake.
 */
function captureLogs(write: (log: pino.Logger) => void): string {
  const chunks: string[] = []
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString())
      callback()
    },
  })

  const internals = logger as unknown as Record<symbol, unknown>
  const originalStream = internals[pino.symbols.streamSym]
  const originalLevel = logger.level

  internals[pino.symbols.streamSym] = sink
  logger.level = 'info'
  try {
    write(logger)
  } finally {
    internals[pino.symbols.streamSym] = originalStream
    logger.level = originalLevel
  }

  return chunks.join('')
}

describe('logger redaction', () => {
  it('redacts cookie and authorization headers', () => {
    const output = captureLogs((log) =>
      log.info(
        {
          req: {
            headers: {
              cookie: 'pspl_session=super-secret-jwt',
              authorization: 'Bearer another-secret',
            },
          },
        },
        'request',
      ),
    )

    expect(output).not.toContain('super-secret-jwt')
    expect(output).not.toContain('another-secret')
    expect(output).toContain('[redacted]')
  })

  it('redacts password, passwordHash, token and secret fields', () => {
    const output = captureLogs((log) =>
      log.info(
        {
          password: 'user-password-value',
          passwordHash: '$2b$12$hash-value',
          csrfToken: 'csrf-token-value',
          secret: 'jwt-signing-secret-value',
        },
        'auth',
      ),
    )

    expect(output).not.toContain('user-password-value')
    expect(output).not.toContain('$2b$12$hash-value')
    expect(output).not.toContain('csrf-token-value')
    expect(output).not.toContain('jwt-signing-secret-value')
  })

  it('redacts an entire log entry body', () => {
    const output = captureLogs((log) =>
      log.info({ body: { email: 'someone@pspl.test', password: 'x' } }, 'login'),
    )

    expect(output).not.toContain('someone@pspl.test')
    expect(output).toContain('[redacted]')
  })

  it('still logs ordinary diagnostic fields (redaction is not vacuous)', () => {
    const output = captureLogs((log) =>
      log.info({ requestId: 'req-123', statusCode: 200 }, 'handled'),
    )

    expect(output).toContain('req-123')
    expect(output).toContain('200')
    expect(output).toContain('handled')
  })
})
