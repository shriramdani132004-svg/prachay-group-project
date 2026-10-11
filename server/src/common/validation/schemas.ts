import { z } from 'zod'

/**
 * Reusable request schemas.
 *
 * Voucher write endpoints are NOT mounted in Phase 3 (they belong to Phases 5-7
 * along with their authorization rules). These schemas are implemented and unit
 * tested now so later phases have a validated, reviewed contract to build on.
 */

const MAX_TITLE_LENGTH = 160
const MAX_DESCRIPTION_LENGTH = 4000
const MAX_AMOUNT = 9_999_999_999.99 // NUMERIC(12,2)

/** UUID v4 identifier as used by every Prisma primary key. */
export const uuidSchema = z
  .string()
  .trim()
  .refine((v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v), {
    message: 'Must be a valid UUID',
  })

/**
 * Strict ISO calendar date (YYYY-MM-DD).
 *
 * Rejects ambiguous formats such as DD/MM/YYYY and impossible dates such as
 * 2026-02-31, which `new Date()` would otherwise silently roll over.
 */
export const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be an ISO date in YYYY-MM-DD format')
  .refine((value) => {
    const [y, m, d] = value.split('-').map(Number) as [number, number, number]
    if (m < 1 || m > 12 || d < 1) return false
    const date = new Date(Date.UTC(y, m - 1, d))
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
  }, 'Must be a real calendar date')

/**
 * Monetary amount.
 *
 * Accepted as a JSON number or a decimal string. Validated to at most two
 * decimal places so no precision is silently lost before reaching NUMERIC(12,2).
 */
export const amountSchema = z
  .union([z.number(), z.string()])
  .transform((v, ctx) => {
    const parsed = typeof v === 'number' ? v : Number(v.trim())

    if (!Number.isFinite(parsed)) {
      ctx.addIssue({ code: 'custom', message: 'Amount must be a number' })
      return z.NEVER
    }
    if (!/^\d+(\.\d{1,2})?$/.test(String(v).trim())) {
      ctx.addIssue({ code: 'custom', message: 'Amount must have at most 2 decimal places' })
      return z.NEVER
    }
    return parsed
  })
  .refine((v) => v > 0, { message: 'Amount must be greater than zero' })
  .refine((v) => v <= MAX_AMOUNT, { message: 'Amount exceeds the maximum allowed value' })

/** Body for creating a draft voucher (Employee-only; mounted in Phase 5). */
export const createVoucherSchema = z.object({
  departmentId: uuidSchema,
  expenseTitle: z
    .string()
    .trim()
    .min(1, 'Expense title is required')
    .max(MAX_TITLE_LENGTH, `Expense title must be at most ${MAX_TITLE_LENGTH} characters`),

  expenseCategoryId: uuidSchema,

  expenseDate: isoDateSchema,

  amount: amountSchema,

  expenseDescription: z
    .string()
    .trim()
    .max(MAX_DESCRIPTION_LENGTH, `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`)
    // An empty description means "not provided", not an empty string.
    .transform((value) => (value.length === 0 ? undefined : value))
    .optional(),

  voucherDate: isoDateSchema.optional(),
})

export type CreateVoucherInput = z.infer<typeof createVoucherSchema>

/** Rejection requires a non-empty reason (workflow rule, Phase 6). */
export const rejectVoucherSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, 'A rejection reason of at least 10 characters is required')
    .max(1000, 'Rejection reason must be at most 1000 characters'),
})

/** Free-text search used by Director and Accounts list endpoints (Phase 7). */
export const voucherSearchSchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED']).optional(),
  departmentId: uuidSchema.optional(),
  expenseCategoryId: uuidSchema.optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
})