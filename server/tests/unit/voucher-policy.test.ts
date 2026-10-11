import { describe, expect, it } from 'vitest'
import {
  assertTransition,
  canTransition,
  finalStatusFor,
  isTerminalStatus,
  resolveTransitionPath,
} from '../../src/modules/vouchers/voucher-policy.js'
import { ApiError } from '../../src/common/errors/api-error.js'

describe('voucher lifecycle policy', () => {
  it('allows only DRAFT -> SUBMITTED', () => {
    expect(canTransition('DRAFT', 'SUBMITTED')).toBe(true)
    expect(canTransition('DRAFT', 'APPROVED')).toBe(false)
    expect(canTransition('DRAFT', 'PENDING_APPROVAL')).toBe(false)
    expect(canTransition('DRAFT', 'REJECTED')).toBe(false)
  })

  it('promotes SUBMITTED -> PENDING_APPROVAL', () => {
    expect(canTransition('SUBMITTED', 'PENDING_APPROVAL')).toBe(true)
    expect(canTransition('SUBMITTED', 'APPROVED')).toBe(false)
  })

  it('only allows a Director decision from PENDING_APPROVAL', () => {
    expect(canTransition('PENDING_APPROVAL', 'APPROVED')).toBe(true)
    expect(canTransition('PENDING_APPROVAL', 'REJECTED')).toBe(true)
    expect(canTransition('PENDING_APPROVAL', 'DRAFT')).toBe(false)
    expect(canTransition('PENDING_APPROVAL', 'SUBMITTED')).toBe(false)
  })

  it('treats APPROVED and REJECTED as terminal', () => {
    expect(isTerminalStatus('APPROVED')).toBe(true)
    expect(isTerminalStatus('REJECTED')).toBe(true)
    expect(isTerminalStatus('DRAFT')).toBe(false)
    expect(isTerminalStatus('PENDING_APPROVAL')).toBe(false)

    expect(canTransition('APPROVED', 'REJECTED')).toBe(false)
    expect(canTransition('REJECTED', 'APPROVED')).toBe(false)
  })

  it('never strands a submitted voucher in SUBMITTED', () => {
    const path = resolveTransitionPath('submit', 'DRAFT')

    // Both transitions are recorded for the audit trail...
    expect(path).toEqual(['SUBMITTED', 'PENDING_APPROVAL'])
    // ...but the voucher is persisted in the final state.
    expect(finalStatusFor('submit')).toBe('PENDING_APPROVAL')
    expect(path.at(-1)).toBe(finalStatusFor('submit'))
  })

  it('records the submission timestamp state transition', () => {
    expect(resolveTransitionPath('submit', 'DRAFT')).toContain('SUBMITTED')
  })

  it('resolves single-step paths for the Director decisions', () => {
    expect(resolveTransitionPath('approve', 'PENDING_APPROVAL')).toEqual(['APPROVED'])
    expect(resolveTransitionPath('reject', 'PENDING_APPROVAL')).toEqual(['REJECTED'])
  })

  it('rejects submitting a voucher that is not a draft', () => {
    expect(() => resolveTransitionPath('submit', 'APPROVED')).toThrow(ApiError)
    expect(() => resolveTransitionPath('submit', 'PENDING_APPROVAL')).toThrow(ApiError)
  })

  it('rejects approving from an invalid state', () => {
    expect(() => resolveTransitionPath('approve', 'DRAFT')).toThrow(ApiError)
    expect(() => resolveTransitionPath('approve', 'APPROVED')).toThrow(ApiError)
  })

  it('rejects rejecting from an invalid state', () => {
    expect(() => resolveTransitionPath('reject', 'DRAFT')).toThrow(ApiError)
    expect(() => resolveTransitionPath('reject', 'REJECTED')).toThrow(ApiError)
  })

  it('throws a 422 ApiError for an invalid transition', () => {
    try {
      assertTransition('DRAFT', 'APPROVED')
      expect.unreachable('expected assertTransition to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(422)
    }
  })
})