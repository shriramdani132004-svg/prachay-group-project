import type { UserRole } from '../generated/prisma/enums.js'

/**
 * Authentication / authorization contract.
 *
 * Phase 3 left every guard failing closed. Phase 4 supplies the real
 * implementations in `require-auth.ts`, `require-role.ts` and `csrf.ts`; the
 * types and policy helpers defined here stay in one place so routes and tests
 * agree on what "authorized" means.
 *
 * The SERVER is the security boundary: hiding a button in React is never
 * authorization, and client-supplied roles are never trusted.
 */

export interface AuthenticatedUser {
  id: string
  email: string
  fullName: string
  role: UserRole
  employeeId: string | null
}

export interface RequestAuthContext {
  user: AuthenticatedUser
  sessionId: string
  csrfToken: string
  expiresAt: Date
}

declare global {
  namespace Express {
    interface Request {
      /** Populated only by verified authentication middleware. */
      user?: AuthenticatedUser
      /** Full auth context including session id, for revocation/CSRF checks. */
      auth?: RequestAuthContext
      /** Parsed query object produced by the validation middleware. */
      validatedQuery?: unknown
    }
  }
}

/** Lifecycle states an Employee is permitted to modify. */
export const EDITABLE_VOUCHER_STATUS = 'DRAFT' as const

/**
 * Ownership / organization-wide access policy for signature records.
 *
 * - EMPLOYEE: only signatures on vouchers they created.
 * - DIRECTOR / ACCOUNTS: organization-wide read access.
 * - Unauthenticated: always denied.
 */
export function canAccessSignature(params: {
  requesterRole: UserRole | undefined
  requesterId: string | undefined
  voucherOwnerId: string
}): boolean {
  const { requesterRole, requesterId, voucherOwnerId } = params

  if (!requesterRole || !requesterId) return false
  if (requesterRole === 'DIRECTOR' || requesterRole === 'ACCOUNTS') return true
  if (requesterRole === 'EMPLOYEE') return requesterId === voucherOwnerId

  return false
}

/** May this role read organization-wide voucher data? */
export function canReadAllVouchers(role: UserRole | undefined): boolean {
  return role === 'DIRECTOR' || role === 'ACCOUNTS'
}

/**
 * May this role edit a voucher?
 *
 * Only the owning Employee may edit, and only while the voucher is exactly DRAFT.
 * Accounts is read-only by design even for records it could otherwise see.
 */
export function canEditVoucher(params: {
  role: UserRole | undefined
  userId: string | undefined
  voucherOwnerId: string
  voucherStatus: string
}): boolean {
  const { role, userId, voucherOwnerId, voucherStatus } = params

  if (!role || !userId) return false
  if (role !== 'EMPLOYEE') return false
  if (userId !== voucherOwnerId) return false

  return voucherStatus === EDITABLE_VOUCHER_STATUS
}

/** May this role create a voucher? Employee only (Phase 5 workflow). */
export function canCreateVoucher(role: UserRole | undefined): boolean {
  return role === 'EMPLOYEE'
}

/** May this role approve or reject a voucher? Director only (Phase 6 workflow). */
export function canDecideVoucher(role: UserRole | undefined): boolean {
  return role === 'DIRECTOR'
}