import { prisma } from '../../lib/prisma.js'
import { Prisma } from '../../generated/prisma/client.js'
import {
  buildVoucherWhere,
  dateOnly,
  type VoucherFilterInput,
} from '../vouchers/voucher-query.js'

/**
 * Analytics aggregation service (Phase 7).
 *
 * Every number here is produced by a bounded PostgreSQL aggregate - never by
 * loading rows into Node and summing in JavaScript float. Monetary results
 * arrive as Prisma Decimal and are serialized to exact two-decimal strings.
 *
 * Scope is ALWAYS caller-supplied and ANDed into the WHERE clause, so an
 * Employee can only ever see their own analytics, and Director/Accounts see
 * organization-wide figures.
 */

export type AnalyticsScope = { kind: 'own'; userId: string } | { kind: 'organization' }

function decimalToString(value: unknown): string {
  if (value && typeof (value as { toFixed?: unknown }).toFixed === 'function') {
    return (value as { toFixed: (places: number) => string }).toFixed(2)
  }
  return String(value ?? 0)
}

// ---------------------------------------------------------------------------
// Status distribution
// ---------------------------------------------------------------------------

export interface StatusDistributionItem {
  status: string
  count: number
  /** SUM of amounts in this status. Decimal-safe string. */
  totalAmount: string
}

/**
 * Count + amount per status for the caller's scope.
 *
 * The category totals always add up to the full scoped population: every
 * voucher has exactly one status, and groupBy returns a row per status that
 * exists in the scope.
 */
export async function getStatusDistribution(
  scope: AnalyticsScope,
  query: VoucherFilterInput,
): Promise<StatusDistributionItem[]> {
  const where = buildVoucherWhere(query, scope)

  const grouped = await prisma.voucher.groupBy({
    by: ['status'],
    where,
    _count: { _all: true },
    _sum: { amount: true },
  })

  // Emit all five statuses (zero-filled) so charts have a stable shape.
  const byStatus = new Map(grouped.map((g) => [g.status, g]))
  const order = ['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED']

  return order.map((status) => {
    const row = byStatus.get(status as never)
    return {
      status,
      count: row?._count._all ?? 0,
      totalAmount: decimalToString(row?._sum.amount ?? 0),
    }
  })
}

// ---------------------------------------------------------------------------
// Expense trends over time
// ---------------------------------------------------------------------------

export interface TrendPoint {
  /** Bucket start, ISO date (YYYY-MM-01 for monthly, YYYY-MM-DD for daily). */
  period: string
  count: number
  totalAmount: string
}

export interface ExpenseTrend {
  granularity: 'day' | 'month'
  /** Inclusive date window actually applied (after defaults). */
  from: string
  to: string
  points: TrendPoint[]
}

/**
 * Expense trend grouped by expense date.
 *
 * Convention (documented in ARCHITECTURE.md §13):
 * - Default window: last 12 calendar months, bounded by the server clock.
 * - Default granularity: month. Callers may request 'day'.
 * - Only vouchers with an expenseDate inside the window are counted.
 * - The trend includes ALL statuses by default (callers can pass status in
 *   the query to narrow it). Amounts are SUMmed by PostgreSQL NUMERIC.
 * - Buckets with no rows are omitted; the UI renders gaps honestly.
 */
export async function getExpenseTrend(
  scope: AnalyticsScope,
  query: VoucherFilterInput,
  options: { granularity?: 'day' | 'month'; from?: string; to?: string } = {},
): Promise<ExpenseTrend> {
  const granularity = options.granularity ?? 'month'

  // Default window: last 12 months ending today (server clock).
  const now = new Date()
  const defaultTo = now.toISOString().slice(0, 10)
  const defaultFromDate = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const defaultFrom = defaultFromDate.toISOString().slice(0, 10)

  const from = options.from ?? query.dateFrom ?? defaultFrom
  const to = options.to ?? query.dateTo ?? defaultTo

  // Prisma cannot GROUP BY a date trunc directly through the typed client, so
  // we use a parameterized raw query. Values are bound (never interpolated)
  // and the WHERE clause mirrors buildVoucherWhere for the date/status parts.
  const conditions: Prisma.Sql[] = []

  if (scope.kind === 'own') {
    conditions.push(Prisma.sql`v."createdById" = ${scope.userId}`)
  }
  if (query.status) {
    conditions.push(Prisma.sql`v.status = ${query.status}::"VoucherStatus"`)
  }
  if (query.departmentId) {
    conditions.push(Prisma.sql`v."departmentId" = ${query.departmentId}`)
  }
  if (query.expenseCategoryId) {
    conditions.push(Prisma.sql`v."expenseCategoryId" = ${query.expenseCategoryId}`)
  }

  conditions.push(Prisma.sql`v."expenseDate" >= ${dateOnly(from)}`)
  conditions.push(Prisma.sql`v."expenseDate" <= ${dateOnly(to)}`)

  const whereSql = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty

  const truncExpression =
    granularity === 'month'
      ? Prisma.sql`to_char(v."expenseDate", 'YYYY-MM')`
      : Prisma.sql`to_char(v."expenseDate", 'YYYY-MM-DD')`

  const rows = await prisma.$queryRaw<{ period: string; count: bigint; total: string }[]>(Prisma.sql`
    SELECT
      ${truncExpression} AS period,
      COUNT(*)::bigint AS count,
      COALESCE(SUM(v.amount), 0)::text AS total
    FROM vouchers v
    ${whereSql}
    GROUP BY 1
    ORDER BY 1 ASC
  `)

  return {
    granularity,
    from,
    to,
    points: rows.map((r) => ({
      period: r.period,
      count: Number(r.count),
      totalAmount: decimalToString(r.total),
    })),
  }
}

// ---------------------------------------------------------------------------
// Category breakdown
// ---------------------------------------------------------------------------

export interface CategoryBreakdownItem {
  categoryId: string
  categoryName: string
  count: number
  totalAmount: string
  /** Share of the scoped total amount, 0-100, two decimals. */
  percentage: string
}

/**
 * Per-category expense breakdown for the caller's scope.
 *
 * Treatment of statuses: ALL statuses are included by default so the
 * breakdown reflects everything recorded; callers can pass `status` in the
 * query to narrow (e.g. APPROVED-only for spend reporting). The percentage
 * is computed against the scoped total amount (NUMERIC), never in float on
 * the client.
 */
export async function getCategoryBreakdown(
  scope: AnalyticsScope,
  query: VoucherFilterInput,
): Promise<CategoryBreakdownItem[]> {
  const where = buildVoucherWhere(query, scope)

  const grouped = await prisma.voucher.groupBy({
    by: ['expenseCategoryId'],
    where,
    _count: { _all: true },
    _sum: { amount: true },
  })

  if (grouped.length === 0) return []

  const categoryIds = grouped.map((g) => g.expenseCategoryId)
  const categories = await prisma.expenseCategory.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  })
  const nameById = new Map(categories.map((c) => [c.id, c.name]))

  // Grand total for percentage share (NUMERIC in the database).
  const grandTotal = grouped.reduce(
    (acc, g) => acc.plus(g._sum.amount ?? 0),
    new Prisma.Decimal(0),
  )
  const grandTotalNumber = grandTotal.toNumber()

  return grouped
    .map((g) => {
      const amount = g._sum.amount ?? new Prisma.Decimal(0)
      const share = grandTotalNumber > 0 ? amount.div(grandTotal).times(100) : new Prisma.Decimal(0)
      return {
        categoryId: g.expenseCategoryId,
        categoryName: nameById.get(g.expenseCategoryId) ?? 'Uncategorised',
        count: g._count._all,
        totalAmount: decimalToString(amount),
        percentage: share.toFixed(2),
      }
    })
    .sort((a, b) => Number(b.totalAmount) - Number(a.totalAmount))
}

// ---------------------------------------------------------------------------
// Accounts dashboard
// ---------------------------------------------------------------------------

export interface AccountsDashboard {
  totalVouchers: number
  pendingApprovalCount: number
  approvedCount: number
  rejectedCount: number
  /**
   * SUM(amount) over vouchers with status APPROVED. This is the "total
   * approved expense" definition: only records that reached APPROVED via the
   * real decision workflow (reviewedById + approvedAt set by the Director
   * approve endpoint) contribute.
   */
  totalApprovedExpenseAmount: string
  recentApprovedVouchers: {
    id: string
    voucherNumber: string
    expenseTitle: string
    amount: string
    currency: string
    approvedAt: string
    reviewedByName: string | null
    createdByName: string | null
    departmentName: string
  }[]
}

/**
 * Accounts organization-wide dashboard aggregates.
 *
 * Accounts is organization-wide READ ONLY by policy. Each figure is a
 * separate bounded aggregate; the recent-approved list is a small ordered
 * page, not a full scan.
 */
export async function getAccountsDashboard(): Promise<AccountsDashboard> {
  const [totalVouchers, pendingCount, approvedCount, rejectedCount, approvedSum, recentApproved] =
    await Promise.all([
      prisma.voucher.count(),
      prisma.voucher.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.voucher.count({ where: { status: 'APPROVED' } }),
      prisma.voucher.count({ where: { status: 'REJECTED' } }),
      prisma.voucher.aggregate({
        where: { status: 'APPROVED' },
        _sum: { amount: true },
      }),
      prisma.voucher.findMany({
        where: { status: 'APPROVED' },
        orderBy: { approvedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          voucherNumber: true,
          expenseTitle: true,
          amount: true,
          currency: true,
          approvedAt: true,
          reviewedBy: { select: { fullName: true } },
          createdBy: { select: { fullName: true } },
          department: { select: { name: true } },
        },
      }),
    ])

  return {
    totalVouchers,
    pendingApprovalCount: pendingCount,
    approvedCount,
    rejectedCount,
    totalApprovedExpenseAmount: decimalToString(approvedSum._sum.amount ?? 0),
    recentApprovedVouchers: recentApproved.map((v) => ({
      id: v.id,
      voucherNumber: v.voucherNumber,
      expenseTitle: v.expenseTitle,
      amount: decimalToString(v.amount),
      currency: v.currency,
      approvedAt: v.approvedAt ? v.approvedAt.toISOString() : '',
      reviewedByName: v.reviewedBy?.fullName ?? null,
      createdByName: v.createdBy?.fullName ?? null,
      departmentName: v.department.name,
    })),
  }
}

// ---------------------------------------------------------------------------
// Recent activity feed
// ---------------------------------------------------------------------------

export interface ActivityFeedItem {
  id: string
  type: string
  voucherId: string
  voucherNumber: string
  actorName: string | null
  createdAt: string
  reason: string | null
}

/**
 * Role-scoped recent activity from the real voucher-event stream.
 *
 * - 'own': only events on vouchers the user created (Employee).
 * - 'organization': all events (Director/Accounts).
 *
 * Only actor display name, event type, timestamp and the voucher number are
 * exposed - no storage paths, no emails, no ids beyond the voucher id needed
 * for navigation.
 */
export async function getRecentActivity(
  scope: AnalyticsScope,
  limit = 15,
): Promise<ActivityFeedItem[]> {
  const voucherWhere: Prisma.VoucherWhereInput =
    scope.kind === 'own' ? { createdById: scope.userId } : {}

  const events = await prisma.voucherEvent.findMany({
    where: { voucher: voucherWhere },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 50),
    select: {
      id: true,
      type: true,
      createdAt: true,
      metadata: true,
      actor: { select: { fullName: true } },
      voucher: { select: { id: true, voucherNumber: true } },
    },
  })

  return events.map((e) => {
    const metadata = (e.metadata ?? null) as { reason?: unknown } | null
    return {
      id: e.id,
      type: e.type,
      voucherId: e.voucher.id,
      voucherNumber: e.voucher.voucherNumber,
      actorName: e.actor?.fullName ?? null,
      createdAt: e.createdAt.toISOString(),
      reason: typeof metadata?.reason === 'string' ? metadata.reason : null,
    }
  })
}
