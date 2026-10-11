import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../../common/errors/api-error.js'
import { sendSuccess } from '../../common/types/response.js'
import { validate } from '../../middleware/validate-request.js'
import { requireAuth } from '../../middleware/require-auth.js'
import { requireCsrf, validateLoginOrigin } from '../../middleware/csrf.js'
import { loginRateLimiter } from '../../middleware/rate-limit.js'
import { authenticate, logout as logoutService } from '../../services/auth.service.js'
import { findActiveSession } from '../../services/session.service.js'
import { setSessionCookie, clearSessionCookie } from './session-cookie.js'
import type { UserRole } from '../../generated/prisma/enums.js'

export const authRouter = Router()

/**
 * Login body.
 *
 * Strict: unknown fields are stripped, so a client cannot smuggle `role`,
 * `id` or `isActive` into the credentials payload.
 */
const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(3, 'Email is required')
      .max(255, 'Email is too long')
      .email('A valid email address is required'),
    password: z
      .string()
      .min(1, 'Password is required')
      // bcrypt silently truncates beyond 72 bytes; reject rather than mislead.
      .max(200, 'Password is too long'),
  })
  .strict()

/**
 * POST /api/v1/auth/login
 *
 * Public, but rate limited and origin-checked. Returns sanitized user data and
 * the session-bound CSRF token. The JWT is delivered ONLY via the cookie and is
 * never included in the response body.
 */
authRouter.post(
  '/login',
  loginRateLimiter,
  validateLoginOrigin,
  validate({ body: loginSchema }),
  async (req, res, next) => {
    try {
      const { email, password } = req.body as z.infer<typeof loginSchema>

      const result = await authenticate(email, password, {
        userAgent: req.header('user-agent'),
        ipAddress: req.ip,
      })

      setSessionCookie(res, result.token, result.session.expiresAt)

      sendSuccess(res, {
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          role: result.user.role,
          employeeId: result.user.employeeId,
        },
        csrfToken: result.session.csrfToken,
        expiresAt: result.session.expiresAt.toISOString(),
      })
    } catch (error) {
      next(error)
    }
  },
)

/**
 * GET /api/v1/auth/me
 *
 * Rehydrates the frontend after a page refresh. Returns the CSRF token again so
 * an in-memory-only token can be recovered without re-login.
 */
authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const auth = req.auth!

    sendSuccess(res, {
      user: {
        id: auth.user.id,
        email: auth.user.email,
        fullName: auth.user.fullName,
        role: auth.user.role,
        employeeId: auth.user.employeeId,
      },
      csrfToken: auth.csrfToken,
      expiresAt: auth.expiresAt.toISOString(),
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/v1/auth/logout
 *
 * Revokes the server-side session and clears the cookie. Requires a valid CSRF
 * token when a valid authenticated cookie is present, so a cross-site request
 * cannot force a logout. Safe to repeat after the session has ended.
 */
authRouter.post('/logout', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const auth = req.auth!

    await logoutService(auth.sessionId)
    clearSessionCookie(res)

    sendSuccess(res, { revoked: true })
  } catch (error) {
    // Always clear the cookie, even if revocation failed, so the browser is
    // never left holding a cookie the server will always reject.
    clearSessionCookie(res)
    next(error)
  }
})

/**
 * Revokes every active session for the current user.
 *
 * Provided as a session-management capability; the UI for it is not part of
 * Phase 4.
 */
authRouter.post('/logout-all', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const auth = req.auth!
    const { revokeAllUserSessions } = await import('../../services/session.service.js')

    const revoked = await revokeAllUserSessions(auth.user.id)
    clearSessionCookie(res)

    sendSuccess(res, { revokedSessions: revoked })
  } catch (error) {
    clearSessionCookie(res)
    next(error)
  }
})

export type { UserRole }
export { ApiError, findActiveSession }