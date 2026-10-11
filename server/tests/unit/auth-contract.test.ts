import { describe, expect, it } from 'vitest'
import { canAccessSignature } from '../../src/middleware/auth-contract.js'

/**
 * The signature access policy must FAIL CLOSED until Phase 4 supplies a
 * verified authenticated identity.
 */
describe('canAccessSignature', () => {
  it('denies every unauthenticated request', () => {
    expect(
      canAccessSignature({
        requesterRole: undefined,
        requesterId: undefined,
        voucherOwnerId: 'owner-1',
      }),
    ).toBe(false)
  })

  it('denies a requester with a role but no identity', () => {
    expect(
      canAccessSignature({
        requesterRole: 'DIRECTOR',
        requesterId: undefined,
        voucherOwnerId: 'owner-1',
      }),
    ).toBe(false)
  })

  it('denies an identity with no role', () => {
    expect(
      canAccessSignature({
        requesterRole: undefined,
        requesterId: 'user-1',
        voucherOwnerId: 'owner-1',
      }),
    ).toBe(false)
  })

  it('allows an employee to reach only their own voucher signature', () => {
    expect(
      canAccessSignature({
        requesterRole: 'EMPLOYEE',
        requesterId: 'user-1',
        voucherOwnerId: 'user-1',
      }),
    ).toBe(true)

    expect(
      canAccessSignature({
        requesterRole: 'EMPLOYEE',
        requesterId: 'user-2',
        voucherOwnerId: 'user-1',
      }),
    ).toBe(false)
  })

  it('allows organization-wide access for Director and Accounts', () => {
    expect(
      canAccessSignature({
        requesterRole: 'DIRECTOR',
        requesterId: 'director-1',
        voucherOwnerId: 'anyone',
      }),
    ).toBe(true)

    expect(
      canAccessSignature({
        requesterRole: 'ACCOUNTS',
        requesterId: 'accounts-1',
        voucherOwnerId: 'anyone',
      }),
    ).toBe(true)
  })
})