import { describe, expect, it } from 'vitest'
import {
  canAccessSignature,
  canCreateVoucher,
  canDecideVoucher,
  canEditVoucher,
  canReadAllVouchers,
  EDITABLE_VOUCHER_STATUS,
} from '../../src/middleware/auth-contract.js'

/**
 * Role-permission matrix.
 *
 * An undefined role/user represents an unauthenticated caller and must always
 * be denied.
 */
describe('role permission matrix', () => {
  it('only EMPLOYEE may create vouchers', () => {
    expect(canCreateVoucher('EMPLOYEE')).toBe(true)
    expect(canCreateVoucher('DIRECTOR')).toBe(false)
    expect(canCreateVoucher('ACCOUNTS')).toBe(false)
    expect(canCreateVoucher(undefined)).toBe(false)
  })

  it('only DIRECTOR may decide (approve/reject) vouchers', () => {
    expect(canDecideVoucher('DIRECTOR')).toBe(true)
    expect(canDecideVoucher('EMPLOYEE')).toBe(false)
    expect(canDecideVoucher('ACCOUNTS')).toBe(false)
    expect(canDecideVoucher(undefined)).toBe(false)
  })

  it('only DIRECTOR and ACCOUNTS may read organization-wide data', () => {
    expect(canReadAllVouchers('DIRECTOR')).toBe(true)
    expect(canReadAllVouchers('ACCOUNTS')).toBe(true)
    expect(canReadAllVouchers('EMPLOYEE')).toBe(false)
    expect(canReadAllVouchers(undefined)).toBe(false)
  })

  it('EXPOSE the expected editable status', () => {
    expect(EDITABLE_VOUCHER_STATUS).toBe('DRAFT')
  })
})

describe('employee voucher edit policy (DRAFT only)', () => {
  const base = { userId: 'emp-1', voucherOwnerId: 'emp-1' }

  it('allows an employee to edit their own DRAFT voucher', () => {
    expect(canEditVoucher({ ...base, role: 'EMPLOYEE', voucherStatus: 'DRAFT' })).toBe(true)
  })

  it('denies editing any non-DRAFT status', () => {
    for (const status of ['SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED']) {
      expect(
        canEditVoucher({ ...base, role: 'EMPLOYEE', voucherStatus: status }),
        `status ${status} must not be editable`,
      ).toBe(false)
    }
  })

  it('denies an employee editing another employee voucher even in DRAFT', () => {
    expect(
      canEditVoucher({
        role: 'EMPLOYEE',
        userId: 'emp-1',
        voucherOwnerId: 'emp-2',
        voucherStatus: 'DRAFT',
      }),
    ).toBe(false)
  })

  it('denies DIRECTOR and ACCOUNTS editing entirely (Accounts is read-only)', () => {
    expect(
      canEditVoucher({ role: 'DIRECTOR', userId: 'd1', voucherOwnerId: 'd1', voucherStatus: 'DRAFT' }),
    ).toBe(false)
    expect(
      canEditVoucher({ role: 'ACCOUNTS', userId: 'a1', voucherOwnerId: 'a1', voucherStatus: 'DRAFT' }),
    ).toBe(false)
  })

  it('denies an unauthenticated caller', () => {
    expect(
      canEditVoucher({
        role: undefined,
        userId: undefined,
        voucherOwnerId: 'emp-1',
        voucherStatus: 'DRAFT',
      }),
    ).toBe(false)
  })
})

describe('signature access policy', () => {
  it('denies anonymous access', () => {
    expect(
      canAccessSignature({ requesterRole: undefined, requesterId: undefined, voucherOwnerId: 'v' }),
    ).toBe(false)
  })

  it('allows an employee to reach only their own voucher signature', () => {
    expect(
      canAccessSignature({ requesterRole: 'EMPLOYEE', requesterId: 'e1', voucherOwnerId: 'e1' }),
    ).toBe(true)
    expect(
      canAccessSignature({ requesterRole: 'EMPLOYEE', requesterId: 'e2', voucherOwnerId: 'e1' }),
    ).toBe(false)
  })

  it('allows organization-wide signature access for DIRECTOR and ACCOUNTS', () => {
    expect(
      canAccessSignature({ requesterRole: 'DIRECTOR', requesterId: 'd', voucherOwnerId: 'anyone' }),
    ).toBe(true)
    expect(
      canAccessSignature({ requesterRole: 'ACCOUNTS', requesterId: 'a', voucherOwnerId: 'anyone' }),
    ).toBe(true)
  })
})