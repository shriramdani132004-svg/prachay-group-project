import type { Response } from 'express'
import { env } from '../../config/env.js'

/**
 * Shared session-cookie creation and clearing logic.
 *
 * Login, logout and logout-all all use these helpers so the cookie attributes
 * live in exactly ONE place, and so the production `__Host-` policy can be
 * verified directly instead of being re-declared per route.
 *
 * - HttpOnly: the JWT is unreachable from JavaScript.
 * - SameSite=Lax: blocks cross-site POST while still allowing normal navigation.
 * - Path=/: required for the `__Host-` prefix rules.
 * - No Domain attribute: host-only cookie.
 * - Secure: true in production (HTTPS) only.
 */
export function buildSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: env.cookieSameSite,
    path: env.cookiePath,
    secure: env.cookieSecure,
    expires: expiresAt,
  } as const
}

/** Clearing must use the SAME attributes the cookie was set with. */
export function buildClearSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: env.cookieSameSite,
    path: env.cookiePath,
    secure: env.cookieSecure,
  } as const
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(env.sessionCookieName, token, buildSessionCookieOptions(expiresAt))
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(env.sessionCookieName, buildClearSessionCookieOptions())
}
