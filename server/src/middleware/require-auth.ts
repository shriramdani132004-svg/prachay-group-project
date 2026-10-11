import type { RequestHandler } from 'express'
import { ApiError } from '../common/errors/api-error.js'
import { env } from '../config/env.js'
import { verifySessionToken } from '../services/jwt.service.js'
import { findActiveSession } from '../services/session.service.js'
import type { UserRole } from '../generated/prisma/enums.js'

/**
 * Centralized authentication middleware.
 *
 * Order of checks, all of which must pass:
 * 1. Session cookie present.
 * 2. JWT signature/algorithm/issuer/audience/expiry valid.
 * 3. Referenced database session exists, is not revoked and has not expired.
 * 4. Associated user exists and is still active.
 *
 * The role is re-read from the DATABASE on every request, never trusted from a
 * stale role claim in the token, so a role change takes effect immediately.
 */

const GENERIC_AUTH_ERROR = 'Authentication is required.'

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = readSessionCookie(req)

    if (!token) {
      throw ApiError.unauthorized(GENERIC_AUTH_ERROR)
    }

    // Throws for a bad signature, unexpected algorithm, wrong issuer/audience or expiry.
    const claims = await verifySessionToken(token)

    const session = await findActiveSession(claims.sid)

    // Rejects revoked, expired, unknown-session and inactive-user cases alike.
    if (!session) {
      throw ApiError.unauthorized('Your session is no longer valid. Please sign in again.')
    }

    // The token subject must match the session owner.
    if (session.userId !== claims.sub) {
      throw ApiError.unauthorized(GENERIC_AUTH_ERROR)
    }

    req.user = {
      id: session.userId,
      email: session.email,
      fullName: session.fullName,
      role: session.role as UserRole,
      employeeId: session.employeeId,
    }

    req.auth = {
      user: req.user,
      sessionId: session.id,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
    }

    next()
  } catch (error) {
    if (error instanceof ApiError) return next(error)

    // Any unexpected verification failure is reported as a generic 401 so no
    // cryptographic or database detail reaches the client.
    req.log?.debug({ err: error }, 'Authentication rejected')
    next(ApiError.unauthorized(GENERIC_AUTH_ERROR))
  }
}

/** Reads the session cookie from the request, if present and well-formed. */
function readSessionCookie(req: { cookies?: Record<string, string | undefined> }): string | null {
  const raw = req.cookies?.[env.sessionCookieName]
  if (typeof raw !== 'string' || raw.length === 0) return null
  return raw
}

/**
 * Optional authentication.
 *
 * Attaches the user when a valid session is present but never rejects.
 * Useful for endpoints that render differently for signed-in users.
 */
export const optionalAuth: RequestHandler = async (req, res, next) => {
  if (!req.cookies?.[env.sessionCookieName]) return next()
  return requireAuth(req, res, (error?: unknown) => next(error as Error))
}