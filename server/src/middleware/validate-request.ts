import type { RequestHandler } from 'express'
import type { ZodType } from 'zod'
import { ApiError } from '../common/errors/api-error.js'
import { toFieldIssues } from '../common/pagination/pagination.js'

export interface ValidationTargets {
  body?: ZodType
  query?: ZodType
  params?: ZodType
}

/**
 * Validates and coerces request input with Zod.
 *
 * Parsed output replaces the raw input so downstream handlers receive fully
 * typed, trusted data. Failures become a 400 with per-field issues.
 */
export function validate(targets: ValidationTargets): RequestHandler {
  return (req, _res, next) => {
    try {
      if (targets.params) {
        req.params = targets.params.parse(req.params) as typeof req.params
      }
      if (targets.query) {
        // req.query has only a getter in Express 5, so the parsed value is
        // stashed separately rather than assigned over it.
        req.validatedQuery = targets.query.parse(req.query)
      }
      if (targets.body) {
        req.body = targets.body.parse(req.body ?? {})
      }
      next()
    } catch (error) {
      if (error instanceof ApiError) return next(error)

      const zodError = error as { issues?: unknown; name?: string }
      if (zodError?.name === 'ZodError' && Array.isArray(zodError.issues)) {
        return next(
          ApiError.validation('The request contains invalid fields.', toFieldIssues(zodError as never)),
        )
      }

      next(error)
    }
  }
}