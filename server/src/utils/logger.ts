import pino from 'pino'
import { env } from '../config/env.js'

/**
 * Structured application logger (Pino).
 *
 * Redaction is configured defensively: credentials and session material must
 * never reach the log stream even if a future caller passes them by mistake.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: 'pspl-voucher-api',
    env: env.NODE_ENV,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'req.headers["set-cookie"]',
      'res.headers["set-cookie"]',
      'body',
      // Top-level credential fields (pino's `*.x` wildcard only matches one
      // level deep, so both forms must be listed).
      'password',
      'passwordHash',
      'token',
      'secret',
      'csrfToken',
      'jwt',
      'connectionString',
      'databaseUrl',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.secret',
      '*.csrfToken',
      '*.jwt',
      '*.connectionString',
      '*.databaseUrl',
      '*.DATABASE_URL',
    ],
    censor: '[redacted]',
  },
  transport: env.isDevelopment
    ? {
        target: 'pino/file',
        options: { destination: 1 },
      }
    : undefined,
})