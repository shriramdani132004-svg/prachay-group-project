import { ApiError } from '../../common/errors/api-error.js'
import { prisma } from '../../lib/prisma.js'
import {
  canDecideVoucher,
  canEditVoucher,
  canReadAllVouchers,
  type AuthenticatedUser,
} from '../../middleware/auth-contract.js'
import type { UserRole } from '../../generated/prisma/enums.js'

/**
 * Voucher authorization policies.
 *
 * These are the reusable rules referenced by routes and by the HTTP tests. They
 * deliberately perform NO mutation: Phase 5/6 own the workflows.
 */

/**
 * Loads a voucher scoped by ownership.
 *
 * For an Employee the owner id is part of the QUERY, not a post-fetch check, so
 * another employee's voucher is never even read. A non-owned or missing record
 * both return 404, which avoids disclosing that the id exists at all.
 */
export async function loadVoucherForRead(
  user: AuthenticatedUser,
  voucherId: string,
): Promise<{ id: string; createdById: string; status: string }> {
  const where = canReadAllVouchers(user.role)
    ? { id: voucherId }
    : { id: voucherId, createdById: user.id }

  const voucher = await prisma.voucher.findFirst({
    where,
    select: { id: true, createdById: true, status: true },
  })

  if (!voucher) {
    throw ApiError.notFound('The requested voucher does not exist.')
  }

  return voucher
}

/**
 * Authorization check for editing a voucher.
 *
 * Distinguishes the two distinct failures:
 * - not yours / does not exist  -> 404 (no IDOR information leak)
 * - yours but not DRAFT         -> 409 (exists, but lifecycle forbids it)
 */
export async function assertCanEditVoucher(
  user: AuthenticatedUser,
  voucherId: string,
): Promise<{ id: string; status: string }> {
  // Only an EMPLOYEE may edit, and only their own voucher. For every other
  // role the record is treated as if it did not exist, so a non-employee cannot
  // even confirm that an id is real (no IDOR information leak).
  if (user.role !== 'EMPLOYEE') {
    throw ApiError.notFound('The requested voucher does not exist.')
  }

  const voucher = await prisma.voucher.findFirst({
    where: { id: voucherId, createdById: user.id },
    select: { id: true, createdById: true, status: true },
  })

  // Not yours, or does not exist -> 404, for the same reason.
  if (!voucher) {
    throw ApiError.notFound('The requested voucher does not exist.')
  }

  if (!canEditVoucher({
    role: user.role,
    userId: user.id,
    voucherOwnerId: voucher.createdById,
    voucherStatus: voucher.status,
  })) {
    // The record exists and is theirs, but its lifecycle state forbids editing.
    throw new ApiError(
      409,
      'INVALID_STATE_TRANSITION',
      `A voucher in ${voucher.status} cannot be edited. Only DRAFT vouchers are editable.`,
    )
  }

  return { id: voucher.id, status: voucher.status }
}

/**
 * Authorization check for a Director approve/reject decision.
 *
 * Only DIRECTOR passes. Everyone else is rejected BEFORE any state is read or
 * written. The approve/reject route then enforces workflow state (409) and the
 * signature precondition (422).
 */
export async function assertCanDecideVoucher(user: AuthenticatedUser): Promise<void> {
  if (!canDecideVoucher(user.role)) {
    throw ApiError.forbidden('Only a Director may approve or reject vouchers.')
  }
}

/** Role guard used by reference-data and organization-wide list endpoints. */
export function assertCanReadOrganizationData(user: AuthenticatedUser): void {
  if (!canReadAllVouchers(user.role)) {
    throw ApiError.forbidden('You do not have permission to view organization-wide data.')
  }
}

export function assertRole(user: AuthenticatedUser, ...allowed: UserRole[]): void {
  if (!allowed.includes(user.role)) {
    throw ApiError.forbidden('You do not have permission to perform this action.')
  }
}