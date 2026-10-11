import { ApiError } from '../../common/errors/api-error.js'

/**
 * Voucher lifecycle policy.
 *
 * Mirrors ARCHITECTURE.md section 5. Implemented and unit tested in Phase 3 so
 * the state machine is settled and reviewable before the Phase 5/6 endpoints
 * depend on it. The endpoints themselves are deliberately not mounted yet.
 *
 * Key decision (resolved explicitly):
 * A completed submit leaves the voucher in PENDING_APPROVAL. SUBMITTED is a
 * transient state recorded within the same transaction so the audit trail shows
 * both "submitted" and "pending approval" transitions, while the row itself is
 * never left stranded in the intermediate state.
 */

export const VOUCHER_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
] as const

export type VoucherStatusValue = (typeof VOUCHER_STATUSES)[number]

export type VoucherAction = 'submit' | 'promote' | 'approve' | 'reject'

const ALLOWED_TRANSITIONS: Record<VoucherStatusValue, readonly VoucherStatusValue[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: [],
}

/**
 * The single state a voucher rests in once an action completes.
 *
 * `submit` resolves to PENDING_APPROVAL, not SUBMITTED: the acknowledgement and
 * the pipeline promotion are recorded as two audit events inside one
 * transaction, and the row itself must never be left in the transient state.
 */
const ACTION_RESULT: Record<VoucherAction, VoucherStatusValue> = {
  submit: 'PENDING_APPROVAL',
  promote: 'PENDING_APPROVAL',
  approve: 'APPROVED',
  reject: 'REJECTED',
}

export function canTransition(from: VoucherStatusValue, to: VoucherStatusValue): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export function isTerminalStatus(status: VoucherStatusValue): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0
}

export function assertTransition(from: VoucherStatusValue, to: VoucherStatusValue): void {
  if (!canTransition(from, to)) {
    throw ApiError.unprocessable(
      `A voucher in ${from} cannot transition to ${to}.`,
    )
  }
}

/**
 * Resolves the full ordered status path for an action.
 *
 * `submit` deliberately returns two steps so the audit trail records the
 * acknowledgement and the pipeline promotion as distinct, auditable events.
 */
export function resolveTransitionPath(
  action: VoucherAction,
  from: VoucherStatusValue,
): VoucherStatusValue[] {
  switch (action) {
    case 'submit': {
      const path: VoucherStatusValue[] = ['SUBMITTED']
      assertTransition(from, 'SUBMITTED')
      // Promotion always follows the acknowledgement within the same transaction.
      path.push('PENDING_APPROVAL')
      return path
    }
    case 'promote': {
      assertTransition(from, 'PENDING_APPROVAL')
      return ['PENDING_APPROVAL']
    }
    case 'approve': {
      assertTransition(from, 'APPROVED')
      return ['APPROVED']
    }
    case 'reject': {
      assertTransition(from, 'REJECTED')
      return ['REJECTED']
    }
    default: {
      const exhaustive: never = action
      throw new Error(`Unhandled voucher action: ${String(exhaustive)}`)
    }
  }
}

/** The status a voucher must be persisted in once the action completes. */
export function finalStatusFor(action: VoucherAction): VoucherStatusValue {
  return ACTION_RESULT[action]
}