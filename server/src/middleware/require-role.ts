import type { RequestHandler } from 'express'
import type { UserRole } from '../generated/prisma/enums.js'
import { ApiError } from '../common/errors/api-error.js'

/**
 * Role-based authorization.
 *
 * Always used AFTER `requireAuth`, so the role is the one resolved from the
 * database during authentication - never from client input or a stale claim.
 *
 * An authenticated user without the required role receives 403 (not 401):
 * they are known, they simply are not permitted.
 */
export function requireRole(...allowed: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    const user = req.user

    // Defensive: reaching here without authentication is always an error.
    if (!user) {
      return next(ApiError.unauthorized('Authentication is required.'))
    }

    if (!allowed.includes(user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action.'))
    }

    next()
  }
}

/**
 * Ensures a route is only reachable with an authenticated session.
 *
 * Kept as an explicit seam so the Phase 3 fail-closed behaviour can be replaced
 * without every call site changing.
 */
export { requireAuth } from './require-auth.js'