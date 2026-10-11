import { SignJWT, jwtVerify, errors as joseErrors } from 'jose'
import crypto from 'node:crypto'
import { env } from '../config/env.js'

/**
 * JWT service.
 *
 * Uses the maintained `jose` library - signing and verification are never
 * hand-written. The algorithm is pinned to HS256 and explicitly allow-listed so
 * a token cannot be downgraded to `none` or an asymmetric algorithm.
 *
 * The JWT is only ever delivered through the HttpOnly session cookie; it is
 * never returned in a response body and never logged.
 */

export const SESSION_COOKIE = env.sessionCookieName

const ALLOWED_ALGORITHMS = ['HS256'] as const

/** HS256 requires a key of at least 256 bits (32 bytes). */
const secretKey = new TextEncoder().encode(env.JWT_SECRET)

if (secretKey.byteLength < 32) {
  throw new Error('JWT_SECRET must provide at least 32 bytes of secret material for HS256.')
}

export interface SessionClaims {
  /** Subject: the authenticated user's UUID. */
  sub: string
  /** Session id, referencing the revocable auth_sessions row. */
  sid: string
  role: string
}

/** Creates a signed session token for an already-persisted session row. */
export async function signSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ sid: claims.sid, role: claims.role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setExpirationTime(`${env.JWT_TTL_SECONDS}s`)
    .sign(secretKey)
}

export interface VerifiedToken {
  sub: string
  sid: string
  role: string
}

/**
 * Verifies a session token.
 *
 * Rejects a wrong signature, an unexpected algorithm, a wrong issuer or
 * audience, and an expired token. Throws on any failure so callers cannot
 * accidentally continue with partial state.
 */
export async function verifySessionToken(token: string): Promise<VerifiedToken> {
  const { payload } = await jwtVerify(token, secretKey, {
    algorithms: [...ALLOWED_ALGORITHMS],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    clockTolerance: 5,
  })

  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('Token subject is missing.')
  }

  const sid = payload['sid']
  if (typeof sid !== 'string' || sid.length === 0) {
    throw new Error('Token session id is missing.')
  }

  return { sub: payload.sub, sid, role: typeof payload['role'] === 'string' ? payload['role'] : '' }
}

/** Generates a cryptographically random, session-bound CSRF token. */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/** True when a jose error represents a credential that must be rejected. */
export function isTokenVerificationError(error: unknown): boolean {
  return (
    error instanceof joseErrors.JOSEError ||
    error instanceof joseErrors.JWTExpired ||
    error instanceof joseErrors.JWTInvalid ||
    error instanceof joseErrors.JWSSignatureVerificationFailed ||
    error instanceof joseErrors.JWTClaimValidationFailed
  )
}