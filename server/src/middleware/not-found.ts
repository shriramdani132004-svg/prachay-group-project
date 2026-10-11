import type { RequestHandler } from 'express'
import { ErrorCode } from '../common/errors/api-error.js'

/**
 * Terminal 404 handler for unmatched routes.
 *
 * Registered after all routers so every unknown path returns the standard error
 * envelope instead of Express's default HTML page.
 */
export const notFound: RequestHandler = (req, res) => {
  const requestId = (res.locals.requestId as string | undefined) ?? 'unknown'

  res.status(404).json({
    success: false,
    error: {
      code: ErrorCode.NOT_FOUND,
      message: `No API route matches ${req.method} ${req.originalUrl}.`,
    },
    meta: { timestamp: new Date().toISOString(), requestId },
  })
}