import { z } from 'zod'
import { ApiError, type FieldIssue } from '../errors/api-error.js'

/**
 * Reusable pagination primitives.
 *
 * Sort keys are always validated against an explicit allow-list and mapped to
 * known columns, so a client-supplied string is never interpolated into an
 * ORDER BY clause.
 */

export const DEFAULT_PAGE = 1
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

export type SortDirection = 'asc' | 'desc'

export interface PaginationMeta {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface NormalizedPagination<TSortKey extends string> {
  page: number
  pageSize: number
  skip: number
  take: number
  sortBy: TSortKey
  sortOrder: SortDirection
}

/**
 * Builds a Zod schema for a sortable, paginated list endpoint.
 *
 * @param allowedSortKeys Whitelist of sortable columns. Never derived from user input.
 */
export function buildPaginationSchema<TSortKey extends string>(
  allowedSortKeys: readonly TSortKey[],
  defaultSortKey: TSortKey,
) {
  const allowed = allowedSortKeys as readonly string[]

  return z.object({
    page: z.coerce
      .number()
      .int('page must be an integer')
      .min(1, 'page must be greater than or equal to 1')
      .default(DEFAULT_PAGE),

    pageSize: z.coerce
      .number()
      .int('pageSize must be an integer')
      .min(1, 'pageSize must be greater than or equal to 1')
      .max(MAX_PAGE_SIZE, `pageSize must be less than or equal to ${MAX_PAGE_SIZE}`)
      .default(DEFAULT_PAGE_SIZE),

    sortBy: z
      .string()
      .refine((value) => allowed.includes(value), {
        message: `sortBy must be one of: ${allowed.join(', ')}`,
      })
      .default(defaultSortKey),

    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
}

/**
 * Converts raw (unvalidated) query input into normalized pagination.
 *
 * Used by endpoints that accept arbitrary query strings. Returns a 400 with a
 * per-field explanation rather than silently falling back to defaults.
 */
export function normalizePagination<TSortKey extends string>(
  query: Record<string, unknown>,
  allowedSortKeys: readonly TSortKey[],
  defaultSortKey: TSortKey,
): NormalizedPagination<TSortKey> {
  const schema = buildPaginationSchema(allowedSortKeys, defaultSortKey)
  const result = schema.safeParse(query)

  if (!result.success) {
    const issues = toFieldIssues(result.error)
    const fields = [...new Set(issues.map((i) => i.field))].join(', ')

    throw ApiError.validation(
      fields
        ? `Invalid pagination parameters: ${fields}.`
        : 'Invalid pagination parameters.',
      issues,
    )
  }

  const { page, pageSize, sortBy, sortOrder } = result.data

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    // Safe: sortBy already passed the allow-list refinement above.
    sortBy: sortBy as TSortKey,
    sortOrder,
  }
}

/** Maps Zod issues onto the API's FieldIssue shape. */
export function toFieldIssues(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    issue: issue.message,
  }))
}

export function buildPaginationMeta(page: number, pageSize: number, totalItems: number): PaginationMeta {
  const totalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) : 0

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  }
}