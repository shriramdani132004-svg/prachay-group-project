import bcrypt from 'bcryptjs'
import { ApiError } from '../common/errors/api-error.js'

/**
 * Password hashing service.
 *
 * Uses bcryptjs (pure JavaScript, no native build step) with a work factor of
 * at least 12. Plaintext passwords are never stored, logged or compared.
 */

/** Cost factor. 12 is the project minimum mandated by the security design. */
export const BCRYPT_COST = 12

const MIN_PASSWORD_LENGTH = 12
const MAX_PASSWORD_LENGTH = 200

export async function hashPassword(plaintext: string): Promise<string> {
  assertPasswordAcceptable(plaintext)
  return bcrypt.hash(plaintext, BCRYPT_COST)
}

/**
 * Verifies a plaintext candidate against a stored hash.
 *
 * Returns false rather than throwing for a missing hash so an unprovisioned
 * account is indistinguishable from a wrong password at the call site.
 */
export async function verifyPassword(plaintext: string, passwordHash: string | null | undefined): Promise<boolean> {
  if (!passwordHash) return false
  if (typeof plaintext !== 'string' || plaintext.length === 0) return false

  try {
    return await bcrypt.compare(plaintext, passwordHash)
  } catch {
    // A malformed stored hash must never crash the login path.
    return false
  }
}

/**
 * Constant-ish work dummy comparison.
 *
 * Called when the email is unknown or the account has no password, so response
 * timing does not reveal whether an account exists.
 */
let dummyHash: string | null = null

async function burnEquivalentTime(): Promise<void> {
  if (!dummyHash) {
    dummyHash = await bcrypt.hash('pspl-dummy-comparison-value', BCRYPT_COST)
  }
  await bcrypt.compare('pspl-dummy-comparison-value', dummyHash)
}

export async function performDummyComparison(): Promise<void> {
  try {
    await burnEquivalentTime()
  } catch {
    // Never allowed to affect the authentication outcome.
  }
}

export function assertPasswordAcceptable(plaintext: string): void {
  if (typeof plaintext !== 'string' || plaintext.length < MIN_PASSWORD_LENGTH) {
    throw ApiError.validation('Password does not meet the security requirements.')
  }
  if (plaintext.length > MAX_PASSWORD_LENGTH) {
    throw ApiError.validation('Password is too long.')
  }
}

/** Timing-safe string comparison used for the session-bound CSRF token. */
export function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false

  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}