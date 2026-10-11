import { Router } from 'express'
import { checkDatabaseConnection } from '../../lib/prisma.js'
import { sendSuccess } from '../../common/types/response.js'
import { ApiError } from '../../common/errors/api-error.js'
import { env } from '../../config/env.js'

export const healthRouter = Router()

const startedAt = Date.now()

/**
 * Liveness: is the process running?
 *
 * Deliberately does NOT touch PostgreSQL so a transient database outage cannot
 * cause an orchestrator to kill an otherwise healthy process.
 */
healthRouter.get('/live', (_req, res) => {
  sendSuccess(res, {
    status: 'alive',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  })
})

/**
 * Readiness: can the service actually serve requests? Requires the database.
 *
 * A dependency failure is reported as 503 (not 500): the service itself is fine,
 * a required dependency is not. The underlying error is logged server-side and
 * never serialized to the client.
 */
healthRouter.get('/ready', async (_req, res, next) => {
  try {
    await checkDatabaseConnection()
    sendSuccess(res, { status: 'ready', database: 'up' })
  } catch (error) {
    _req.log?.error({ err: error }, 'Readiness probe failed')
    next(
      ApiError.databaseUnavailable(
        'The service is running but its database is currently unreachable.',
      ),
    )
  }
})

/**
 * Health: application + database connectivity.
 *
 * Returns 200 only when a real round-trip to PostgreSQL succeeds; otherwise a
 * safe 503. Never reports a fake healthy database state.
 */
healthRouter.get('/', async (_req, res, next) => {
  const latencyStart = Date.now()

  try {
    await checkDatabaseConnection()

    sendSuccess(res, {
      status: 'healthy',
      service: 'pspl-voucher-api',
      environment: env.NODE_ENV,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      checks: {
        database: { status: 'up', latencyMs: Date.now() - latencyStart },
      },
    })
  } catch (error) {
    _req.log?.error({ err: error }, 'Health probe failed')
    next(
      ApiError.databaseUnavailable(
        'The service is running but its database is currently unreachable.',
      ),
    )
  }
})