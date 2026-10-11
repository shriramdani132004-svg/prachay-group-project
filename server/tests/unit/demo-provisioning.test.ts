import { describe, expect, it } from 'vitest'
import crypto from 'node:crypto'

process.env.JWT_SECRET = crypto.randomBytes(48).toString('base64url')
process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'silent'

const { validateProvisioningPreconditions } = await import('../../scripts/provision-demo.js')

/**
 * Demo provisioning safety rules.
 *
 * These guard the command against being used as a credential backdoor.
 */

const STRONG = {
  DEMO_EMPLOYEE_1_PASSWORD: 'Independent-Strong-Pass-1!',
  DEMO_EMPLOYEE_2_PASSWORD: 'Independent-Strong-Pass-2!',
  DEMO_DIRECTOR_PASSWORD: 'Independent-Strong-Pass-3!',
  DEMO_ACCOUNTS_PASSWORD: 'Independent-Strong-Pass-4!',
}

const provider = (overrides: Record<string, string | undefined> = {}) =>
  (name: string) => overrides[name]

describe('demo provisioning preconditions', () => {
  it('accepts a valid development configuration', () => {
    const result = validateProvisioningPreconditions('development', 'true', provider(STRONG))
    expect(result.ok).toBe(true)
  })

  it('refuses to run in production even when enabled', () => {
    const result = validateProvisioningPreconditions('production', 'true', provider(STRONG))

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons.join(' ')).toMatch(/production/i)
    }
  })

  it('requires DEMO_AUTH_ENABLED to be explicitly true', () => {
    for (const value of [undefined, 'false', 'TRUE', '1', 'yes']) {
      const result = validateProvisioningPreconditions('development', value, provider(STRONG))
      expect(result.ok, `value ${String(value)} must be refused`).toBe(false)
    }
  })

  it('refuses when a demo password is missing', () => {
    for (const key of Object.keys(STRONG)) {
      const partial = { ...STRONG, [key]: undefined }
      const result = validateProvisioningPreconditions('development', 'true', provider(partial))

      expect(result.ok, `missing ${key} must be refused`).toBe(false)
      if (!result.ok) {
        expect(result.reasons.join(' ')).toContain(key)
      }
    }
  })

  it('refuses a too-short demo password', () => {
    const weak = { ...STRONG, DEMO_DIRECTOR_PASSWORD: 'short' }
    const result = validateProvisioningPreconditions('development', 'true', provider(weak))

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons.join(' ')).toMatch(/DEMO_DIRECTOR_PASSWORD/)
    }
  })

  it('refuses when demo passwords are not independent', () => {
    const shared = {
      ...STRONG,
      DEMO_DIRECTOR_PASSWORD: STRONG.DEMO_EMPLOYEE_1_PASSWORD,
    }
    const result = validateProvisioningPreconditions('development', 'true', provider(shared))

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons.join(' ')).toMatch(/differ/i)
    }
  })

  it('rejects an empty-string password', () => {
    const empty = { ...STRONG, DEMO_ACCOUNTS_PASSWORD: '' }
    const result = validateProvisioningPreconditions('development', 'true', provider(empty))
    expect(result.ok).toBe(false)
  })
})