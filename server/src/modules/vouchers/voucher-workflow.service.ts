import { ApiError } from '../../common/errors/api-error.js'
import { prisma, type PrismaClient } from '../../lib/prisma.js'
import type { AuthenticatedUser } from '../../middleware/auth-contract.js'
import type { VoucherStatus, VoucherEventType } from '../../generated/prisma/enums.js'
import { Prisma } from '../../generated/prisma/client.js'
import { allocateVoucherNumber } from './voucher-number.service.js'
import {
  finalStatusFor,
  resolveTransitionPath,
  type VoucherStatusValue,
} from './voucher-policy.js'
import {
  loadSignatureForVoucher,
  signatureMissingError,
  verifySignatureUsable,
  deleteVoucherSignatures,
} from '../signatures/signature.service.js'

/**
 * Voucher lifecycle workflows (Phases 5 & 6).
 *
 * Every transition here is:
 * - authorized against the DATABASE-resolved identity (never client claims),
 * - conditional on the current status (concurrency-safe via updateMany counts),
 * - transactionally consistent with its audit events.
 *
 * Money never touches JavaScript floating point: amounts are validated to two
 * decimal places before persistence and summed by PostgreSQL NUMERIC.
 */

// ------------------------------------------------------------------------------
// Serialization helpers
// ------------------------------------------------------------------------------

/** Prisma @db.Date values arrive as UTC-midnight Date objects. */
function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

/**
 * Decimal -> exact two-decimal string ("1500.50").
 *
 * Never through float. Prisma's `toString()` omits trailing zeros, which would
 * make the NUMERIC(12,2) column contract invisible to API consumers.
 */
function decimalToString(value: unknown): string {
  if (value && typeof (value as { toFixed?: unknown }).toFixed === 'function') {
    return (value as { toFixed: (places: number) => string }).toFixed(2)
  }
  return String(value)
}

export interface VoucherSummary {
  id: string
  voucherNumber: string
  voucherDate: string
  expenseDate: string
  expenseTitle: string
  amount: string
  currency: string
  status: VoucherStatus
  departmentId: string
  departmentName: string
  expenseCategoryId: string
  expenseCategoryName: string
  createdById: string
  createdByName: string | null
  submittedAt: string | null
  approvedAt: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
}

const SUMMARY_SELECT = {
  id: true,
  voucherNumber: true,
  voucherDate: true,
  expenseDate: true,
  expenseTitle: true,
  amount: true,
  currency: true,
  status: true,
  departmentId: true,
  department: { select: { name: true } },
  expenseCategoryId: true,
  expenseCategory: { select: { name: true } },
  createdById: true,
  createdBy: { select: { fullName: true } },
  submittedAt: true,
  approvedAt: true,
  rejectedAt: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VoucherSelect

type SummaryRow = Prisma.VoucherGetPayload<{ select: typeof SUMMARY_SELECT }>

export function serializeSummary(row: SummaryRow): VoucherSummary {
  return {
    id: row.id,
    voucherNumber: row.voucherNumber,
    voucherDate: toIsoDate(row.voucherDate),
    expenseDate: toIsoDate(row.expenseDate),
    expenseTitle: row.expenseTitle,
    amount: decimalToString(row.amount),
    currency: row.currency,
    status: row.status,
    departmentId: row.departmentId,
    departmentName: row.department.name,
    expenseCategoryId: row.expenseCategoryId,
    expenseCategoryName: row.expenseCategory.name,
    createdById: row.createdById,
    createdByName: row.createdBy.fullName,
    submittedAt: toIso(row.submittedAt),
    approvedAt: toIso(row.approvedAt),
    rejectedAt: toIso(row.rejectedAt),
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export interface VoucherDetail extends VoucherSummary {
  expenseDescription: string | null
  employeeIdSnapshot: string | null
  employeeNameSnapshot: string | null
  reviewedByName: string | null
  signatures: {
    id: string
    type: 'EMPLOYEE' | 'DIRECTOR'
    mimeType: string
    sizeBytes: number
    createdAt: string
  }[]
}

// ------------------------------------------------------------------------------
// Shared helpers
// ------------------------------------------------------------------------------

async function assertReferenceExists(
  kind: 'department' | 'category',
  id: string,
): Promise<void> {
  const found =
    kind === 'department'
      ? await prisma.department.findUnique({ where: { id }, select: { id: true } })
      : await prisma.expenseCategory.findUnique({ where: { id }, select: { id: true } })

  if (!found) {
    throw ApiError.validation(`The selected ${kind} does not exist.`, [
      { field: kind === 'department' ? 'departmentId' : 'expenseCategoryId', issue: 'Unknown reference' },
    ])
  }
}

async function recordEvent(
  tx: Prisma.TransactionClient,
  params: {
    voucherId: string
    actorId: string
    type: VoucherEventType
    fromStatus?: VoucherStatus
    toStatus?: VoucherStatus
    metadata?: Prisma.InputJsonValue
  },
): Promise<void> {
  await tx.voucherEvent.create({
    data: {
      voucherId: params.voucherId,
      actorId: params.actorId,
      type: params.type,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      metadata: params.metadata,
    },
  })
}

// ------------------------------------------------------------------------------
// Phase 5 - Employee draft lifecycle
// ------------------------------------------------------------------------------

export interface CreateDraftInput {
  departmentId: string
  expenseTitle: string
  expenseCategoryId: string
  expenseDate: string
  amount: number
  expenseDescription?: string
  voucherDate?: string
}

/**
 * Creates an owned DRAFT.
 *
 * Ownership and identity snapshots come from the AUTHENTICATED user record;
 * the request body cannot influence them (the schema is strict and contains no
 * owner/status/number fields).
 */
export async function createDraft(user: AuthenticatedUser, input: CreateDraftInput) {
  await assertReferenceExists('department', input.departmentId)
  await assertReferenceExists('category', input.expenseCategoryId)

  const today = new Date()
  const voucherDate = input.voucherDate ? new Date(`${input.voucherDate}T00:00:00.000Z`) : today
  const expenseDate = new Date(`${input.expenseDate}T00:00:00.000Z`)

  return prisma.$transaction(async (tx) => {
    const voucherNumber = await allocateVoucherNumber(tx as unknown as PrismaClient)

    const voucher = await tx.voucher.create({
      data: {
        voucherNumber,
        voucherDate,
        expenseDate,
        departmentId: input.departmentId,
        expenseTitle: input.expenseTitle,
        expenseCategoryId: input.expenseCategoryId,
        expenseDescription: input.expenseDescription,
        amount: new Prisma.Decimal(input.amount),
        createdById: user.id,
        employeeIdSnapshot: user.employeeId,
        employeeNameSnapshot: user.fullName,
        status: 'DRAFT',
      },
    })

    await recordEvent(tx, {
      voucherId: voucher.id,
      actorId: user.id,
      type: 'CREATED',
      toStatus: 'DRAFT',
    })

    return voucher.id
  })
}

export interface UpdateDraftInput {
  expenseTitle?: string
  expenseDescription?: string
  expenseDate?: string
  amount?: number
  departmentId?: string
  expenseCategoryId?: string
}

/**
 * Updates an owned DRAFT.
 *
 * The UPDATE is conditional on (id, createdById, status=DRAFT) so a concurrent
 * submission can never be overwritten by a stale edit.
 */
export async function updateDraft(user: AuthenticatedUser, voucherId: string, input: UpdateDraftInput) {
  if (input.departmentId) await assertReferenceExists('department', input.departmentId)
  if (input.expenseCategoryId) await assertReferenceExists('category', input.expenseCategoryId)

  const data: Prisma.VoucherUpdateInput = {}
  if (input.expenseTitle !== undefined) data.expenseTitle = input.expenseTitle
  if (input.expenseDescription !== undefined) data.expenseDescription = input.expenseDescription
  if (input.expenseDate !== undefined) data.expenseDate = new Date(`${input.expenseDate}T00:00:00.000Z`)
  if (input.amount !== undefined) data.amount = new Prisma.Decimal(input.amount)
  if (input.departmentId !== undefined) data.department = { connect: { id: input.departmentId } }
  if (input.expenseCategoryId !== undefined) data.expenseCategory = { connect: { id: input.expenseCategoryId } }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.voucher.updateMany({
      where: { id: voucherId, createdById: user.id, status: 'DRAFT' },
      data,
    })

    if (updated.count === 0) {
      // Distinguish "not yours / missing" (404) from "no longer DRAFT" (409).
      const existing = await tx.voucher.findFirst({
        where: { id: voucherId, createdById: user.id },
        select: { status: true },
      })
      if (!existing) throw ApiError.notFound('The requested voucher does not exist.')
      throw new ApiError(
        409,
        'INVALID_STATE_TRANSITION',
        `A voucher in ${existing.status} cannot be edited. Only DRAFT vouchers are editable.`,
      )
    }

    await recordEvent(tx, {
      voucherId,
      actorId: user.id,
      type: 'UPDATED',
      fromStatus: 'DRAFT',
      toStatus: 'DRAFT',
    })

    return tx.voucher.findUniqueOrThrow({ where: { id: voucherId }, select: { id: true } })
  })

  return result.id
}

/** Deletes an owned DRAFT and retires its private signature files. */
export async function deleteDraft(user: AuthenticatedUser, voucherId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const deleted = await tx.voucher.deleteMany({
      where: { id: voucherId, createdById: user.id, status: 'DRAFT' },
    })

    if (deleted.count === 0) {
      const existing = await tx.voucher.findFirst({
        where: { id: voucherId, createdById: user.id },
        select: { status: true },
      })
      if (!existing) throw ApiError.notFound('The requested voucher does not exist.')
      throw new ApiError(
        409,
        'INVALID_STATE_TRANSITION',
        `A voucher in ${existing.status} cannot be deleted. Only DRAFT vouchers can be deleted.`,
      )
    }
  })

  // Rows are gone (signatures cascaded). Retire the private files afterwards;
  // a failure here leaves unreferenced bytes, never an accessible signature.
  await deleteVoucherSignatures(voucherId).catch(() => undefined)
}

/**
 * Submits an owned DRAFT for approval.
 *
 * Preconditions (re-checked inside the transaction):
 * - the voucher is still DRAFT (conditional update defeats double-submit),
 * - required business fields are present,
 * - an EMPLOYEE-type signature is attached AND its private file is intact
 *   (exists, size + SHA-256 match the recorded metadata).
 *
 * The row ends in PENDING_APPROVAL. SUBMITTED is recorded as a transient audit
 * event in the same transaction (established Phase 3 lifecycle design).
 */
export async function submitDraft(user: AuthenticatedUser, voucherId: string) {
  const voucher = await prisma.voucher.findFirst({
    where: { id: voucherId, createdById: user.id },
    select: {
      id: true,
      status: true,
      expenseTitle: true,
      expenseDescription: true,
      amount: true,
      departmentId: true,
      expenseCategoryId: true,
      expenseDate: true,
    },
  })

  if (!voucher) throw ApiError.notFound('The requested voucher does not exist.')
  if (voucher.status !== 'DRAFT') {
    throw new ApiError(
      409,
      'INVALID_STATE_TRANSITION',
      `A voucher in ${voucher.status} cannot be submitted. Only DRAFT vouchers can be submitted.`,
    )
  }

  // Business-field completeness (defense in depth: the schema already enforces
  // these on create/update, but a draft could predate a rule change).
  if (!voucher.expenseTitle.trim()) {
    throw ApiError.validation('An expense title is required before submission.', [
      { field: 'expenseTitle', issue: 'Required' },
    ])
  }
  if (!voucher.expenseDate) {
    throw ApiError.validation('An expense date is required before submission.', [
      { field: 'expenseDate', issue: 'Required' },
    ])
  }
  if (Number(voucher.amount) <= 0) {
    throw ApiError.validation('A positive amount is required before submission.', [
      { field: 'amount', issue: 'Must be greater than zero' },
    ])
  }

  const employeeSignature = await loadSignatureForVoucher(voucherId, 'EMPLOYEE')
  if (!employeeSignature) throw signatureMissingError('EMPLOYEE')
  if (!(await verifySignatureUsable(employeeSignature))) {
    throw ApiError.unprocessable(
      'The employee signature file is missing or corrupted. Please upload it again.',
    )
  }

  const path = resolveTransitionPath('submit', 'DRAFT')

  await prisma.$transaction(async (tx) => {
    const updated = await tx.voucher.updateMany({
      where: { id: voucherId, createdById: user.id, status: 'DRAFT' },
      data: { status: finalStatusFor('submit'), submittedAt: new Date() },
    })

    if (updated.count === 0) {
      throw new ApiError(
        409,
        'INVALID_STATE_TRANSITION',
        'This voucher has already been submitted or is no longer editable.',
      )
    }

    // Audit trail: acknowledgement + pipeline promotion, one transaction.
    await recordEvent(tx, {
      voucherId,
      actorId: user.id,
      type: 'SUBMITTED',
      fromStatus: 'DRAFT',
      toStatus: path[0],
    })
    await recordEvent(tx, {
      voucherId,
      actorId: user.id,
      type: 'PENDING_APPROVAL',
      fromStatus: path[0],
      toStatus: path[1],
    })
  })

  return getDetail(voucherId)
}

// ------------------------------------------------------------------------------
// Phase 6 - Director decision workflow
// ------------------------------------------------------------------------------

/**
 * Loads a voucher for a Director decision, requiring PENDING_APPROVAL.
 *
 * 404 for missing (no existence oracle for arbitrary ids), 409 when the
 * current state does not permit a decision (already decided or still draft).
 *
 * Exported for the signature-upload route: a Director signature may only be
 * attached to a voucher that is actually awaiting a decision.
 */
export async function loadDecidableVoucher(voucherId: string) {
  const voucher = await prisma.voucher.findFirst({
    where: { id: voucherId },
    select: { id: true, status: true },
  })

  if (!voucher) throw ApiError.notFound('The requested voucher does not exist.')
  if (voucher.status !== 'PENDING_APPROVAL') {
    throw new ApiError(
      409,
      'INVALID_STATE_TRANSITION',
      `A voucher in ${voucher.status} cannot be decided. Only PENDING_APPROVAL vouchers can be approved or rejected.`,
    )
  }

  return voucher
}

/** Requires an intact DIRECTOR-type signature on the voucher. */
async function requireUsableDirectorSignature(voucherId: string): Promise<void> {
  const directorSignature = await loadSignatureForVoucher(voucherId, 'DIRECTOR')
  if (!directorSignature) throw signatureMissingError('DIRECTOR')
  if (!(await verifySignatureUsable(directorSignature))) {
    throw ApiError.unprocessable(
      'The director signature file is missing or corrupted. Please upload it again.',
    )
  }
}

/**
 * Approves a PENDING_APPROVAL voucher (Director only).
 *
 * Concurrency: the status flip is an `updateMany` conditioned on
 * PENDING_APPROVAL, so two simultaneous decisions can never both succeed -
 * the loser receives 409 and no success event is recorded.
 */
export async function approveVoucher(user: AuthenticatedUser, voucherId: string) {
  await loadDecidableVoucher(voucherId)
  await requireUsableDirectorSignature(voucherId)

  const now = new Date()

  await prisma.$transaction(async (tx) => {
    const updated = await tx.voucher.updateMany({
      where: { id: voucherId, status: 'PENDING_APPROVAL' },
      data: { status: 'APPROVED', reviewedById: user.id, approvedAt: now },
    })

    if (updated.count === 0) {
      throw new ApiError(
        409,
        'INVALID_STATE_TRANSITION',
        'This voucher has already been decided by another reviewer.',
      )
    }

    await recordEvent(tx, {
      voucherId,
      actorId: user.id,
      type: 'APPROVED',
      fromStatus: 'PENDING_APPROVAL',
      toStatus: 'APPROVED',
    })
  })

  return getDetail(voucherId)
}

/**
 * Rejects a PENDING_APPROVAL voucher with a required reason (Director only).
 *
 * Same concurrency and signature rules as approval. The reason is trimmed and
 * validated by the route schema before this service runs.
 */
export async function rejectVoucher(user: AuthenticatedUser, voucherId: string, reason: string) {
  await loadDecidableVoucher(voucherId)
  await requireUsableDirectorSignature(voucherId)

  const now = new Date()
  const trimmedReason = reason.trim()

  await prisma.$transaction(async (tx) => {
    const updated = await tx.voucher.updateMany({
      where: { id: voucherId, status: 'PENDING_APPROVAL' },
      data: {
        status: 'REJECTED',
        reviewedById: user.id,
        rejectedAt: now,
        rejectionReason: trimmedReason,
      },
    })

    if (updated.count === 0) {
      throw new ApiError(
        409,
        'INVALID_STATE_TRANSITION',
        'This voucher has already been decided by another reviewer.',
      )
    }

    await recordEvent(tx, {
      voucherId,
      actorId: user.id,
      type: 'REJECTED',
      fromStatus: 'PENDING_APPROVAL',
      toStatus: 'REJECTED',
      metadata: { reason: trimmedReason },
    })
  })

  return getDetail(voucherId)
}

// ------------------------------------------------------------------------------
// Reads: detail, events, list, dashboards
// ------------------------------------------------------------------------------

/** Full detail. Callers must have passed an ownership/org authorization check. */
export async function getDetail(voucherId: string): Promise<VoucherDetail> {
  const voucher = await prisma.voucher.findUniqueOrThrow({
    where: { id: voucherId },
    select: {
      ...SUMMARY_SELECT,
      expenseDescription: true,
      employeeIdSnapshot: true,
      employeeNameSnapshot: true,
      reviewedBy: { select: { fullName: true } },
      signatures: {
        select: { id: true, type: true, mimeType: true, sizeBytes: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  return {
    ...serializeSummary(voucher),
    expenseDescription: voucher.expenseDescription,
    employeeIdSnapshot: voucher.employeeIdSnapshot,
    employeeNameSnapshot: voucher.employeeNameSnapshot,
    reviewedByName: voucher.reviewedBy?.fullName ?? null,
    signatures: voucher.signatures.map((s) => ({
      id: s.id,
      type: s.type,
      mimeType: s.mimeType,
      sizeBytes: s.sizeBytes,
      createdAt: s.createdAt.toISOString(),
    })),
  }
}

export interface WorkflowEvent {
  id: string
  type: VoucherEventType
  fromStatus: VoucherStatus | null
  toStatus: VoucherStatus | null
  actorName: string | null
  reason: string | null
  createdAt: string
}

/** Sanitized timeline for one voucher. No storage paths, no tokens. */
export async function getVoucherEvents(voucherId: string): Promise<WorkflowEvent[]> {
  const events = await prisma.voucherEvent.findMany({
    where: { voucherId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      type: true,
      fromStatus: true,
      toStatus: true,
      createdAt: true,
      actor: { select: { fullName: true } },
      metadata: true,
    },
  })

  return events.map((e) => {
    const metadata = (e.metadata ?? null) as { reason?: unknown } | null
    return {
      id: e.id,
      type: e.type,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      actorName: e.actor?.fullName ?? null,
      reason: typeof metadata?.reason === 'string' ? metadata.reason : null,
      createdAt: e.createdAt.toISOString(),
    }
  })
}

// ------------------------------------------------------------------------------
// Dashboards
// ------------------------------------------------------------------------------

/**
 * "Today" boundaries in SERVER LOCAL time, matching how the operations team
 * reads dates. Exported so tests compute the identical window.
 */
export function startOfToday(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function endOfToday(now: Date = new Date()): Date {
  const start = startOfToday(now)
  return new Date(start.getTime() + 24 * 60 * 60 * 1000)
}

export interface EmployeeDashboard {
  totalVouchers: number
  draftVouchers: number
  pendingApproval: number
  approvedVouchers: number
  rejectedVouchers: number
  /** Sum of the employee's own voucher amounts across ALL statuses. */
  totalAmountClaimed: string
  recentVouchers: VoucherSummary[]
}

/**
 * Employee dashboard aggregates, scoped to the authenticated employee.
 *
 * totalAmountClaimed = SUM(amount) over the employee's own vouchers in every
 * status (drafts included), computed by PostgreSQL NUMERIC - never in JS float.
 */
export async function getEmployeeDashboard(userId: string): Promise<EmployeeDashboard> {
  const where = { createdById: userId }

  const [totalVouchers, byStatus, amount, recent] = await Promise.all([
    prisma.voucher.count({ where }),
    prisma.voucher.groupBy({ by: ['status'], where, _count: { _all: true } }),
    prisma.voucher.aggregate({ where, _sum: { amount: true } }),
    prisma.voucher.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: SUMMARY_SELECT,
    }),
  ])

  const countOf = (status: VoucherStatus): number =>
    byStatus.find((s) => s.status === status)?._count._all ?? 0

  return {
    totalVouchers,
    draftVouchers: countOf('DRAFT'),
    pendingApproval: countOf('PENDING_APPROVAL'),
    approvedVouchers: countOf('APPROVED'),
    rejectedVouchers: countOf('REJECTED'),
    totalAmountClaimed: decimalToString(amount._sum.amount ?? 0),
    recentVouchers: recent.map(serializeSummary),
  }
}

export interface DirectorDashboard {
  pendingApprovalCount: number
  approvedToday: number
  rejectedToday: number
  totalPendingAmount: string
  recentActivity: {
    id: string
    type: VoucherEventType
    voucherNumber: string
    actorName: string | null
    createdAt: string
    reason: string | null
  }[]
  recentVouchers: VoucherSummary[]
}

/**
 * Director dashboard aggregates (organization-wide).
 *
 * "Today" = server-local calendar day (see startOfToday/endOfToday). Pending
 * amount is SUM(amount) over PENDING_APPROVAL rows, computed by PostgreSQL.
 */
export async function getDirectorDashboard(): Promise<DirectorDashboard> {
  const todayStart = startOfToday()
  const todayEnd = endOfToday()

  const [
    pendingApprovalCount,
    approvedToday,
    rejectedToday,
    pendingAmount,
    recentEvents,
    recent,
  ] = await Promise.all([
    prisma.voucher.count({ where: { status: 'PENDING_APPROVAL' } }),
    prisma.voucher.count({
      where: { status: 'APPROVED', approvedAt: { gte: todayStart, lt: todayEnd } },
    }),
    prisma.voucher.count({
      where: { status: 'REJECTED', rejectedAt: { gte: todayStart, lt: todayEnd } },
    }),
    prisma.voucher.aggregate({
      where: { status: 'PENDING_APPROVAL' },
      _sum: { amount: true },
    }),
    prisma.voucherEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        type: true,
        createdAt: true,
        metadata: true,
        actor: { select: { fullName: true } },
        voucher: { select: { voucherNumber: true } },
      },
    }),
    prisma.voucher.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: SUMMARY_SELECT,
    }),
  ])

  return {
    pendingApprovalCount,
    approvedToday,
    rejectedToday,
    totalPendingAmount: decimalToString(pendingAmount._sum.amount ?? 0),
    recentActivity: recentEvents.map((e) => {
      const metadata = (e.metadata ?? null) as { reason?: unknown } | null
      return {
        id: e.id,
        type: e.type,
        voucherNumber: e.voucher.voucherNumber,
        actorName: e.actor?.fullName ?? null,
        createdAt: e.createdAt.toISOString(),
        reason: typeof metadata?.reason === 'string' ? metadata.reason : null,
      }
    }),
    recentVouchers: recent.map(serializeSummary),
  }
}

export type { VoucherStatusValue }
