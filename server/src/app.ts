import express, { type Express } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { pinoHttp } from 'pino-http'

import { env } from './config/env.js'
import { apiRouter } from './routes/index.js'
import { requestId } from './middleware/request-id.js'
import { notFound } from './middleware/not-found.js'
import { errorHandler } from './middleware/error-handler.js'
import { apiRateLimiter } from './middleware/rate-limit.js'
import { logger } from './utils/logger.js'

/**
 * Express application factory.
 *
 * Deliberately performs NO network binding so tests can mount it with Supertest
 * without occupying a port. `server.ts` owns the actual listening operation.
 */
export function createApp(): Express {
  const app = express()

  // Only trust a proxy when explicitly configured; never blindly.
  app.set('trust proxy', env.TRUST_PROXY_HOPS)
  app.disable('x-powered-by')

  app.use(requestId)

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  )

  /**
   * CORS with an explicit allow-list.
   *
   * Credentials are enabled (required for the session cookie), so a wildcard
   * origin is never acceptable. Only origins present in CORS_ORIGINS are
   * reflected; anything else is rejected rather than passed through.
   */
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true) // non-browser caller

        if (env.corsOrigins.includes(origin)) return callback(null, true)

        // Passing an Error here makes the cors middleware throw, which would
        // surface as a generic 500. Returning false omits the CORS headers
        // instead; the route-level origin guard (validateLoginOrigin) is what
        // actually returns 403 for state-changing requests.
        return callback(null, false)
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', env.csrfHeaderName, 'x-request-id'],
      exposedHeaders: ['x-request-id', 'RateLimit', 'RateLimit-Policy'],
      maxAge: 600,
    }),
  )

  app.use(
    pinoHttp({
      logger,
      genReqId: (_req, res) => (res.locals.requestId as string | undefined) ?? 'unknown',
      autoLogging: {
        ignore: (req) => req.url === `${env.apiPrefix}/health/live`,
      },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error'
        if (res.statusCode >= 400) return 'warn'
        return 'info'
      },
      customSuccessMessage: (req, res) => `${req.method} ${req.url} -> ${res.statusCode}`,
    }),
  )

  // Required for the HttpOnly session cookie. The cookie is signed by JWT,
  // so no additional cookie secret is involved.
  app.use(cookieParser())

  app.use(
    express.json({
      limit: '1mb',
      type: ['application/json', 'application/*+json'],
    }),
  )

  // Baseline API throttling (Phase 4 activation; login has a stricter limit).
  app.use(env.apiPrefix, apiRateLimiter)

  app.get('/', (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        service: 'pspl-voucher-api',
        status: 'ok',
        apiPrefix: env.apiPrefix,
        documentation: 'See server/README.md',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: res.locals.requestId,
      },
    })
  })

  app.use(env.apiPrefix, apiRouter)

  app.use(notFound)
  app.use(errorHandler)

  return app
}