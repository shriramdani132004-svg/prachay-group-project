import { prisma } from '../lib/prisma.js'
import { ApiError } from '../common/errors/api-error.js'
import {
  performDummyComparison,
  verifyPassword,
} from './password.service.js'
import { createSession, revokeSession, type CreatedSession } from './session.service.js'
import { signSessionToken } from './jwt.service.js'
import type { UserRole } from '../generated/prisma/enums.js'

/**
 * Authentication service.
 *
 * Every failure path returns the SAME generic 401 so the API never discloses
 * whether a particular email address exists.
 */

export interface AuthenticatedUserDto {
  id: string
  email: string
  fullName: string
  role: UserRole
  employeeId: string | null
}

export interface LoginResult {
  user: AuthenticatedUserDto
  session: CreatedSession
  token: string
}

/** Normalizes an email for lookup, matching the `lower(email)` unique index. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * The single error returned for every credential failure.
 *
 * Intentionally identical for: unknown email, wrong password, unprovisioned
 * account (no password hash) and deactivated account.
 */
const GENERIC_LOGIN_ERROR = 'Invalid email or password.'

export async function authenticate(
  email: string,
  password: string,
  meta: { userAgent?: string | undefined; ipAddress?: string | undefined } = {},
): Promise<LoginResult> {
  const normalized = normalizeEmail(email)

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      employeeId: true,
      passwordHash: true,
      isActive: true,
    },
  })

  if (!user) {
    // Equalize timing so an unknown email is not measurably faster.
    await performDummyComparison()
    throw ApiError.unauthorized(GENERIC_LOGIN_ERROR)
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash)

  if (!passwordMatches || !user.isActive) {
    throw ApiError.unauthorized(GENERIC_LOGIN_ERROR)
  }

  const session = await createSession(user.id, meta)
  const token = await signSessionToken({ sub: user.id, sid: session.id, role: user.role })

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      employeeId: user.employeeId,
    },
    session,
    token,
  }
}

export async function logout(sessionId: string): Promise<void> {
  await revokeSession(sessionId)
}