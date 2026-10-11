import { describe, expect, it } from 'vitest'
import crypto from 'node:crypto'

process.env.JWT_SECRET = crypto.randomBytes(48).toString('base64url')
process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'silent'

const { hashPassword, verifyPassword, safeCompare, BCRYPT_COST } = await import(
  '../../src/services/password.service.js'
)

describe('password hashing', () => {
  const password = 'A-strong-test-password!42'

  it('hashes with bcrypt at work factor >= 12', async () => {
    const hash = await hashPassword(password)

    expect(BCRYPT_COST).toBeGreaterThanOrEqual(12)
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/)
    // The plaintext must never appear in the hash.
    expect(hash).not.toContain(password)
  })

  it('produces a different hash each time (salted)', async () => {
    const a = await hashPassword(password)
    const b = await hashPassword(password)
    expect(a).not.toBe(b)
  }, 30_000)

  // bcryptjs is pure JS; cost 12 legitimately takes seconds on a loaded CPU,
  // so these tests declare their real budget instead of the 5s default.
  it('verifies a correct password', async () => {
    const hash = await hashPassword(password)
    await expect(verifyPassword(password, hash)).resolves.toBe(true)
  }, 30_000)

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword(password)
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false)
  }, 30_000)

  it('rejects a null password hash (unprovisioned account)', async () => {
    await expect(verifyPassword(password, null)).resolves.toBe(false)
    await expect(verifyPassword(password, undefined)).resolves.toBe(false)
  })

  it('rejects an empty candidate password', async () => {
    const hash = await hashPassword(password)
    await expect(verifyPassword('', hash)).resolves.toBe(false)
  }, 30_000)

  it('rejects a malformed stored hash without throwing', async () => {
    await expect(verifyPassword(password, 'not-a-bcrypt-hash')).resolves.toBe(false)
  })

  it('refuses to hash a too-short password', async () => {
    await expect(hashPassword('short')).rejects.toThrow()
  })
})

describe('constant-time comparison', () => {
  it('returns true for identical strings', () => {
    expect(safeCompare('abcdef', 'abcdef')).toBe(true)
  })

  it('returns false for different strings of equal length', () => {
    expect(safeCompare('abcdef', 'abcdeg')).toBe(false)
  })

  it('returns false for different lengths', () => {
    expect(safeCompare('abc', 'abcdef')).toBe(false)
  })

  it('returns false for a token prefix', () => {
    expect(safeCompare('abc', 'abcdef')).toBe(false)
  })

  it('handles non-string input safely', () => {
    expect(safeCompare(undefined as unknown as string, 'x')).toBe(false)
  })
})