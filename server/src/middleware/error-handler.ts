import type { ErrorRequestHandler } from 'express'
import { Prisma } from '../generated/prisma/client.js'
import { ApiError, ErrorCode } from '../common/errors/api-error.js'
import { logger } from '../utils/logger.js'

/**
 * Centralized error handler (must be registered last).
 *
 * Maps known failures onto safe, predictable responses. Anything unrecognised
 * becomes a generic 500: stack traces, SQL, file paths and connection strings
 * are logged server-side but never serialized to the client.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = (res.locals.requestId as string | undefined) ?? 'unknown'

  if (err instanceof ApiError) {
    if (err.status >= 500) {
      req.log?.error({ err, requestId }, 'Request failed')
    } else {
      req.log?.warn({ code: err.code, status: err.status, requestId, err: err.message }, 'Request rejected')
    }

    return res.status(err.status).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details?.length ? { details: err.details } : {}),
      },
      meta: { timestamp: new Date().toISOString(), requestId },
    })
  }

  // Prisma: record not found
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: {
          code: ErrorCode.CONFLICT,
          message: 'A record with these unique values already exists.',
        },
        meta: { timestamp: new Date().toISOString(), requestId },
      })
    }

    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: { code: ErrorCode.NOT_FOUND, message: 'The requested resource was not found.' },
        meta: { timestamp: new Date().toISOString(), requestId },
      })
    }
  }

  // Prisma / driver: database unreachable or unavailable
  if (err instanceof Prisma.PrismaClientInitializationError) {
    req.log?.error({ err, requestId }, 'Database unavailable')
    return res.status(503).json({
      success: false,
      error: {
        code: ErrorCode.DATABASE_UNAVAILABLE,
        message: 'A required dependency is currently unavailable.',
      },
      meta: { timestamp: new Date().toISOString(), requestId },
    })
  }

  // Body parser failures
  const anyErr = err as { type?: string; status?: number; message?: string }
  if (anyErr?.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: { code: ErrorCode.PAYLOAD_TOO_LARGE, message: 'The request payload is too large.' },
      meta: { timestamp: new Date().toISOString(), requestId },
    })
  }

  if (anyErr?.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'The request body is not valid JSON.' },
      meta: { timestamp: new Date().toISOString(), requestId },
    })
  }

  // Anything else is an unexpected server fault.
  logger.error({ err, requestId, path: req.originalUrl }, 'Unhandled error')

  return res.status(500).json({
    success: false,
    error: { code: ErrorCode.INTERNAL_ERROR, message: 'An unexpected error occurred.' },
    meta: { timestamp: new Date().toISOString(), requestId },
  })
}