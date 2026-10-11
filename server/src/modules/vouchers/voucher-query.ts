import { z } from 'zod'
import { isoDateSchema } from '../../common/validation/schemas.js'
import { buildPaginationSchema } from '../../common/pagination/pagination.js'
import type { Prisma } from '../../generated/prisma/client.js'

/**
 * Shared voucher search/filter/sort/pagination contract (Phase 7).
 *
 * One validated query shape + one Prisma where-builder used by:
 * - Employee list (own scope, applied by the caller)
 * - Director "All Vouchers" / Approval Queue (organization scope)
 * - Accounts register (organization scope, read-only)
 * - Analytics endpoints (same filters, different aggregation)
 *
 * Security invariants:
 * - The scope predicate (own vs organization) is ALWAYS supplied by the
 *   caller's authorization layer and ANDed here; filters can never widen it.
 * - `orderBy` only ever receives an allowlisted column name - never raw
 *   client input - so dynamic Prisma orderBy injection is impossible.
 * - Amount and date range inversions are rejected at validation time, before
 *   a query is built.
 */

export const VOUCHER_SORT_FIELDS = [
  'voucherNumber',
  'expenseDate',
  'voucherDate',
  'amount',
  'createdAt',
  'updatedAt',
  'status',
] as const

export type VoucherSortField = (typeof VOUCHER_SORT_FIELDS)[number]

const statusEnum = z.enum(['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'])

/**
 * Amount filter: must be finite and non-negative. Two-decimal precision is
 * enforced by the shared amountSchema for writes; filters accept any
 * non-negative number and are compared against a NUMERIC column. Coercion is
 * required because query-string values arrive as strings.
 */
const filterAmount = z.coerce
  .number()
  .finite('Amount must be a finite number')
  .min(0, 'Amount must not be negative')

export const voucherListQuerySchema = buildPaginationSchema(VOUCHER_SORT_FIELDS, 'createdAt' as VoucherSortField)
  .extend({
    /** Free-text: voucher number, title, description, employee name. */
    search: z.string().trim().max(200).optional(),
    status: statusEnum.optional(),
    departmentId: z.string().uuid().optional(),
    expenseCategoryId: z.string().uuid().optional(),
    /** Expense-date window (inclusive, day precision). */
    dateFrom: isoDateSchema.optional(),
    dateTo: isoDateSchema.optional(),
    /** Voucher-date window (inclusive, day precision). */
    voucherDateFrom: isoDateSchema.optional(),
    voucherDateTo: isoDateSchema.optional(),
    minAmount: filterAmount.optional(),
    maxAmount: filterAmount.optional(),
  })
  .refine(
    (val) =>
      !(val.minAmount !== undefined && val.maxAmount !== undefined && val.minAmount > val.maxAmount),
    { message: 'Minimum amount cannot exceed maximum amount', path: ['minAmount'] },
  )
  .refine(
    (val) => !(val.dateFrom && val.dateTo && val.dateFrom > val.dateTo),
    { message: 'From date must not be after To date', path: ['dateFrom'] },
  )
  .refine(
    (val) => !(val.voucherDateFrom && val.voucherDateTo && val.voucherDateFrom > val.voucherDateTo),
    { message: 'Voucher From date must not be after Voucher To date', path: ['voucherDateFrom'] },
  )

export type VoucherListQueryInput = z.infer<typeof voucherListQuerySchema>

/**
 * Subset of the list query used by analytics aggregations.
 *
 * Analytics never paginate or sort; they only filter. Keeping this type
 * separate means an analytics route schema does not have to fabricate
 * page/pageSize values that would be ignored.
 */
export interface VoucherFilterInput {
  search?: string
  status?: 'DRAFT' | 'SUBMITTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
  departmentId?: string
  expenseCategoryId?: string
  dateFrom?: string
  dateTo?: string
  voucherDateFrom?: string
  voucherDateTo?: string
  minAmount?: number
  maxAmount?: number
}

/**
 * Builds the Prisma WHERE fragment for the validated query.
 *
 * `scope` is ANDed with every filter so a filter can never widen access:
 * - 'own': only vouchers created by `userId`
 * - 'organization': no ownership predicate (caller has org-wide read)
 *
 * The search text is matched case-insensitively against voucher number, title,
 * description and the employee-name snapshot. All matching happens in the
 * database BEFORE pagination, so counts and pages are consistent.
 */
export function buildVoucherWhere(
  query: VoucherFilterInput,
  scope: { kind: 'own'; userId: string } | { kind: 'organization' },
): Prisma.VoucherWhereInput {
  const clauses: Prisma.VoucherWhereInput[] = []

  if (scope.kind === 'own') {
    clauses.push({ createdById: scope.userId })
  }

  if (query.search) {
    clauses.push({
      OR: [
        { voucherNumber: { contains: query.search, mode: 'insensitive' } },
        { expenseTitle: { contains: query.search, mode: 'insensitive' } },
        { expenseDescription: { contains: query.search, mode: 'insensitive' } },
        { employeeNameSnapshot: { contains: query.search, mode: 'insensitive' } },
      ],
    })
  }

  if (query.status) clauses.push({ status: query.status })
  if (query.departmentId) clauses.push({ departmentId: query.departmentId })
  if (query.expenseCategoryId) clauses.push({ expenseCategoryId: query.expenseCategoryId })

  if (query.dateFrom || query.dateTo) {
    clauses.push({
      expenseDate: {
        ...(query.dateFrom ? { gte: new Date(`${query.dateFrom}T00:00:00.000Z`) } : {}),
        ...(query.dateTo ? { lte: new Date(`${query.dateTo}T23:59:59.999Z`) } : {}),
      },
    })
  }

  if (query.voucherDateFrom || query.voucherDateTo) {
    clauses.push({
      voucherDate: {
        ...(query.voucherDateFrom ? { gte: new Date(`${query.voucherDateFrom}T00:00:00.000Z`) } : {}),
        ...(query.voucherDateTo ? { lte: new Date(`${query.voucherDateTo}T23:59:59.999Z`) } : {}),
      },
    })
  }

  if (query.minAmount !== undefined || query.maxAmount !== undefined) {
    clauses.push({
      amount: {
        ...(query.minAmount !== undefined ? { gte: query.minAmount } : {}),
        ...(query.maxAmount !== undefined ? { lte: query.maxAmount } : {}),
      },
    })
  }

  return clauses.length > 0 ? { AND: clauses } : {}
}

/**
 * Safe ORDER BY from an allowlisted field.
 *
 * `sortBy` is already constrained to VOUCHER_SORT_FIELDS by the Zod schema;
 * this function is a second layer of defense: it maps the validated name to a
 * known column and never spreads client input into Prisma's orderBy.
 */
export function buildVoucherOrderBy(
  sortBy: VoucherSortField,
  sortOrder: 'asc' | 'desc',
): Prisma.VoucherOrderByWithRelationInput {
  const columnMap: Record<VoucherSortField, keyof Prisma.VoucherOrderByWithRelationInput> = {
    voucherNumber: 'voucherNumber',
    expenseDate: 'expenseDate',
    voucherDate: 'voucherDate',
    amount: 'amount',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    status: 'status',
  }

  return { [columnMap[sortBy]]: sortOrder } as Prisma.VoucherOrderByWithRelationInput
}

/** Normalizes a date-only string to a UTC-midnight Date. */
export function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}
