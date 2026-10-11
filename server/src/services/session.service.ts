import crypto from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import { env } from '../config/env.js'
import { generateCsrfToken } from './jwt.service.js'

/**
 * Revocable server-side session store.
 *
 * A JWT is valid until it expires, so every authenticated request is also
 * checked against this table. Logging out sets `revokedAt`, which immediately
 * invalidates a token that was copied before logout.
 */

export interface CreatedSession {
  id: string
  csrfToken: string
  expiresAt: Date
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string | undefined; ipAddress?: string | undefined } = {},
): Promise<CreatedSession> {
  const id = crypto.randomUUID()
  const csrfToken = generateCsrfToken()
  const expiresAt = new Date(Date.now() + env.JWT_TTL_SECONDS * 1000)

  await prisma.authSession.create({
    data: {
      id,
      userId,
      csrfToken,
      expiresAt,
      revokedAt: null,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
      ipAddress: meta.ipAddress?.slice(0, 45) ?? null,
    },
  })

  return { id, csrfToken, expiresAt }
}

/** An active, non-revoked, non-expired session with its user. */
export interface ActiveSession {
  id: string
  userId: string
  csrfToken: string
  expiresAt: Date
  email: string
  fullName: string
  role: string
  isActive: boolean
  employeeId: string | null
}

/**
 * Resolves a session by id and returns it only if it is genuinely usable.
 *
 * A revoked session, an expired session, or a session belonging to a
 * deactivated user all return null.
 */
export async function findActiveSession(sessionId: string): Promise<ActiveSession | null> {
  const session = await prisma.authSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      csrfToken: true,
      expiresAt: true,
      revokedAt: true,
      user: {
        select: { email: true, fullName: true, role: true, isActive: true, employeeId: true },
      },
    },
  })

  if (!session) return null
  if (session.revokedAt !== null) return null
  if (session.expiresAt.getTime() <= Date.now()) return null
  if (!session.user.isActive) return null

  return {
    id: session.id,
    userId: session.userId,
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt,
    email: session.user.email,
    fullName: session.user.fullName,
    role: session.user.role,
    isActive: session.user.isActive,
    employeeId: session.user.employeeId,
  }
}

/**
 * Revokes a single session.
 *
 * Idempotent: revoking an already-revoked or unknown session is not an error, so
 * a repeated logout cannot fail or leave a stale cookie stuck in the browser.
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.authSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/** Revokes every active session for a user (used on password rotation). */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  const result = await prisma.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return result.count
}

/** Housekeeping helper: removes sessions that expired more than a day ago. */
export async function purgeExpiredSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const result = await prisma.authSession.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  })
  return result.count
}