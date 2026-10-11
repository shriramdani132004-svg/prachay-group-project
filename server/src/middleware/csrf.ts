import type { RequestHandler } from 'express'
import { ApiError } from '../common/errors/api-error.js'
import { env } from '../config/env.js'
import { safeCompare } from '../services/password.service.js'

/**
 * CSRF protection for cookie-authenticated state-changing requests.
 *
 * A SameSite cookie is defence in depth, not a complete CSRF control: a
 * same-site attacker page can still issue credentialed requests. The
 * synchronizer token pattern closes that gap.
 *
 * The token is:
 * - generated with a CSPRNG at login,
 * - stored on the server-side session row,
 * - returned in the JSON body of /auth/login and /auth/me,
 * - sent back in the X-CSRF-Token header,
 * - compared against the session's token in constant time.
 *
 * It is never placed in a URL and never stored in localStorage/sessionStorage.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Methods that require a valid CSRF token when authenticated via cookie. */
export const CSRF_PROTECTED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function requiresCsrfProtection(method: string): boolean {
  return CSRF_PROTECTED_METHODS.has(method.toUpperCase())
}

/**
 * CSRF guard.
 *
 * Requires `requireAuth` first: the expected token lives on the authenticated
 * session, so an unauthenticated request is rejected by `requireAuth` anyway.
 */
export const requireCsrf: RequestHandler = (req, _res, next) => {
  // Safe methods never mutate state, so they need no token.
  if (SAFE_METHODS.has(req.method.toUpperCase())) return next()

  const auth = req.auth
  if (!auth) {
    return next(ApiError.unauthorized('Authentication is required.'))
  }

  const header = req.header(env.csrfHeaderName)
  const provided = typeof header === 'string' ? header : ''

  if (!provided) {
    return next(
      ApiError.forbidden('Missing CSRF token. Send it in the X-CSRF-Token header.'),
    )
  }

  if (!safeCompare(provided, auth.csrfToken)) {
    return next(ApiError.forbidden('Invalid CSRF token.'))
  }

  next()
}

/**
 * Login CSRF / cross-origin protection.
 *
 * Login is public, so it is guarded differently from authenticated routes:
 * when a browser supplies an Origin it must be trusted, and Fetch Metadata
 * must not indicate a cross-site request. Non-browser clients (curl, Supertest)
 * send neither header and remain usable.
 */
export const validateLoginOrigin: RequestHandler = (req, _res, next) => {
  const origin = req.header('origin')

  if (origin) {
    if (!env.corsOrigins.includes(origin)) {
      return next(ApiError.forbidden('Untrusted request origin.'))
    }
  }

  // `sec-fetch-site: cross-site` on a state-changing POST is never legitimate here.
  const fetchSite = req.header('sec-fetch-site')
  if (fetchSite === 'cross-site') {
    return next(ApiError.forbidden('Cross-site request rejected.'))
  }

  next()
}