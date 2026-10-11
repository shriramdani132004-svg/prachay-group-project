import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../../common/errors/api-error.js'
import { sendSuccess, sendCreated } from '../../common/types/response.js'
import { validate } from '../../middleware/validate-request.js'
import { requireAuth } from '../../middleware/require-auth.js'
import { requireCsrf } from '../../middleware/csrf.js'
import { uuidSchema, isoDateSchema, amountSchema, rejectVoucherSchema } from '../../common/validation/schemas.js'
import { canReadAllVouchers } from '../../middleware/auth-contract.js'
import {
  assertCanDecideVoucher,
  assertCanEditVoucher,
  assertCanReadOrganizationData,
  loadVoucherForRead,
} from './voucher-policy.service.js'
import {
  buildVoucherOrderBy,
  buildVoucherWhere,
  voucherListQuerySchema,
  type VoucherSortField,
} from './voucher-query.js'
import {
  approveVoucher,
  createDraft,
  deleteDraft,
  getDetail,
  getDirectorDashboard,
  getEmployeeDashboard,
  getVoucherEvents,
  rejectVoucher,
  serializeSummary,
  submitDraft,
  updateDraft,
} from './voucher-workflow.service.js'
import { prisma } from '../../lib/prisma.js'
import { buildPaginationMeta } from '../../common/pagination/pagination.js'
import {
  getAccountsDashboard,
  getCategoryBreakdown,
  getExpenseTrend,
  getRecentActivity,
  getStatusDistribution,
} from '../analytics/analytics.service.js'

export const vouchersRouter = Router()

/**
 * Voucher API (Phases 5 & 6).
 *
 * Route order matters: literal segments (/dashboard, /director/dashboard) are
 * registered before /:id so they are never captured as a voucher id.
 *
 * Every route: requireAuth -> (requireCsrf on unsafe methods) -> validation ->
 * workflow service. Ownership and role checks live in the query or in the
 * policy/workflow services, never in the client.
 */

const idParamSchema = z.object({ id: uuidSchema })

// ------------------------------------------------------------------------------
// Validation schemas
// ------------------------------------------------------------------------------

/** Create-draft body. STRICT: owner/status/number/reviewer fields are rejected. */
const createDraftSchema = z
  .object({
    departmentId: uuidSchema,
    expenseTitle: z.string().trim().min(1, 'Expense title is required').max(160),
    expenseCategoryId: uuidSchema,
    expenseDate: isoDateSchema,
    amount: amountSchema,
    expenseDescription: z
      .string()
      .trim()
      .max(4000)
      .transform((v) => (v.length === 0 ? undefined : v))
      .optional(),
    voucherDate: isoDateSchema.optional(),
  })
  .strict()

/** Patch body: only employee-editable fields. Unknown keys are rejected. */
const updateDraftSchema = z
  .object({
    expenseTitle: z.string().trim().min(1).max(160).optional(),
    expenseDescription: z
      .string()
      .trim()
      .max(4000)
      .transform((v) => (v.length === 0 ? undefined : v))
      .optional(),
    expenseDate: isoDateSchema.optional(),
    amount: amountSchema.optional(),
    departmentId: uuidSchema.optional(),
    expenseCategoryId: uuidSchema.optional(),
  })
  .strict()

// voucherListQuerySchema + buildVoucherWhere/OrderBy now live in
// ./voucher-query.ts (shared with analytics and the Director register).

// ------------------------------------------------------------------------------
// Phase 5 - Employee dashboard (literal path, before /:id)
// ------------------------------------------------------------------------------

vouchersRouter.get('/dashboard', requireAuth, async (req, res, next) => {
  try {
    if (req.user!.role !== 'EMPLOYEE') {
      throw ApiError.forbidden('The employee dashboard is available to employees only.')
    }
    sendSuccess(res, await getEmployeeDashboard(req.user!.id))
  } catch (error) {
    next(error)
  }
})

// ------------------------------------------------------------------------------
// Phase 6 - Director dashboard (literal path, before /:id)
// ------------------------------------------------------------------------------

vouchersRouter.get('/director/dashboard', requireAuth, async (req, res, next) => {
  try {
    await assertCanDecideVoucher(req.user!)
    sendSuccess(res, await getDirectorDashboard())
  } catch (error) {
    next(error)
  }
})

// ------------------------------------------------------------------------------
// Phase 7 - Accounts dashboard (literal path, before /:id)
// ------------------------------------------------------------------------------

vouchersRouter.get('/accounts/dashboard', requireAuth, async (req, res, next) => {
  try {
    assertCanReadOrganizationData(req.user!)
    sendSuccess(res, await getAccountsDashboard())
  } catch (error) {
    next(error)
  }
})

// ------------------------------------------------------------------------------
// Phase 7 - Analytics (literal paths, before /:id)
// ------------------------------------------------------------------------------

const analyticsQuerySchema = z.object({
  status: z.enum(['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED']).optional(),
  departmentId: uuidSchema.optional(),
  expenseCategoryId: uuidSchema.optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  granularity: z.enum(['day', 'month']).optional(),
})

function analyticsScope(user: { id: string; role: 'EMPLOYEE' | 'DIRECTOR' | 'ACCOUNTS' }) {
  return canReadAllVouchers(user.role)
    ? ({ kind: 'organization' } as const)
    : ({ kind: 'own', userId: user.id } as const)
}

vouchersRouter.get(
  '/analytics/status',
  requireAuth,
  validate({ query: analyticsQuerySchema }),
  async (req, res, next) => {
    try {
      const query = req.validatedQuery as z.infer<typeof analyticsQuerySchema>
      sendSuccess(res, await getStatusDistribution(analyticsScope(req.user!), query))
    } catch (error) {
      next(error)
    }
  },
)

vouchersRouter.get(
  '/analytics/trends',
  requireAuth,
  validate({ query: analyticsQuerySchema }),
  async (req, res, next) => {
    try {
      const query = req.validatedQuery as z.infer<typeof analyticsQuerySchema>
      const granularity = (req.validatedQuery as { granularity?: 'day' | 'month' }).granularity
      sendSuccess(
        res,
        await getExpenseTrend(analyticsScope(req.user!), query, { granularity }),
      )
    } catch (error) {
      next(error)
    }
  },
)

vouchersRouter.get(
  '/analytics/categories',
  requireAuth,
  validate({ query: analyticsQuerySchema }),
  async (req, res, next) => {
    try {
      const query = req.validatedQuery as z.infer<typeof analyticsQuerySchema>
      sendSuccess(res, await getCategoryBreakdown(analyticsScope(req.user!), query))
    } catch (error) {
      next(error)
    }
  },
)

vouchersRouter.get('/activity', requireAuth, async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 15
    sendSuccess(res, await getRecentActivity(analyticsScope(req.user!), limit))
  } catch (error) {
    next(error)
  }
})

// ------------------------------------------------------------------------------
// List & create
// ------------------------------------------------------------------------------

/**
 * GET /api/v1/vouchers
 *
 * Employees: own vouchers only (scoped in the query). Directors/Accounts:
 * organization-wide read. Server-side filter, sort and pagination via the
 * shared voucher-query contract.
 */
vouchersRouter.get(
  '/',
  requireAuth,
  validate({ query: voucherListQuerySchema }),
  async (req, res, next) => {
    try {
      const user = req.user!
      const query = req.validatedQuery as z.infer<typeof voucherListQuerySchema>

      const scope = canReadAllVouchers(user.role)
        ? ({ kind: 'organization' } as const)
        : ({ kind: 'own', userId: user.id } as const)

      const where = buildVoucherWhere(query, scope)
      const orderBy = buildVoucherOrderBy(query.sortBy as VoucherSortField, query.sortOrder)
      const skip = (query.page - 1) * query.pageSize

      const [totalItems, rows] = await Promise.all([
        prisma.voucher.count({ where }),
        prisma.voucher.findMany({
          where,
          orderBy,
          skip,
          take: query.pageSize,
          select: {
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
          },
        }),
      ])

      res.status(200).json({
        success: true,
        data: {
          scope: scope.kind === 'organization' ? 'organization' : 'own',
          items: rows.map(serializeSummary),
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: res.locals.requestId,
          pagination: buildPaginationMeta(query.page, query.pageSize, totalItems),
        },
      })
    } catch (error) {
      next(error)
    }
  },
)

/** POST /api/v1/vouchers - create an owned DRAFT (Employee only). */
vouchersRouter.post(
  '/',
  requireAuth,
  requireCsrf,
  validate({ body: createDraftSchema }),
  async (req, res, next) => {
    try {
      const user = req.user!
      if (user.role !== 'EMPLOYEE') {
        throw ApiError.forbidden('Only employees may create vouchers.')
      }

      const id = await createDraft(user, req.body as z.infer<typeof createDraftSchema>)
      sendCreated(res, await getDetail(id))
    } catch (error) {
      next(error)
    }
  },
)

// ------------------------------------------------------------------------------
// Phase 5 - Detail / update / delete / submit
// ------------------------------------------------------------------------------

/** GET /api/v1/vouchers/:id - ownership-scoped full detail. */
vouchersRouter.get(
  '/:id',
  requireAuth,
  validate({ params: idParamSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as z.infer<typeof idParamSchema>
      await loadVoucherForRead(req.user!, id)
      sendSuccess(res, await getDetail(id))
    } catch (error) {
      next(error)
    }
  },
)

/** PATCH /api/v1/vouchers/:id - update an owned DRAFT. */
vouchersRouter.patch(
  '/:id',
  requireAuth,
  requireCsrf,
  validate({ params: idParamSchema, body: updateDraftSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as z.infer<typeof idParamSchema>
      await assertCanEditVoucher(req.user!, id)
      await updateDraft(req.user!, id, req.body as z.infer<typeof updateDraftSchema>)
      sendSuccess(res, await getDetail(id))
    } catch (error) {
      next(error)
    }
  },
)

/** DELETE /api/v1/vouchers/:id - delete an owned DRAFT. */
vouchersRouter.delete(
  '/:id',
  requireAuth,
  requireCsrf,
  validate({ params: idParamSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as z.infer<typeof idParamSchema>
      await assertCanEditVoucher(req.user!, id)
      await deleteDraft(req.user!, id)
      sendSuccess(res, { deleted: true, id })
    } catch (error) {
      next(error)
    }
  },
)

/** POST /api/v1/vouchers/:id/submit - submit an owned eligible DRAFT. */
vouchersRouter.post(
  '/:id/submit',
  requireAuth,
  requireCsrf,
  validate({ params: idParamSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as z.infer<typeof idParamSchema>
      await assertCanEditVoucher(req.user!, id)
      sendSuccess(res, await submitDraft(req.user!, id))
    } catch (error) {
      next(error)
    }
  },
)

// ------------------------------------------------------------------------------
// Phase 6 - Director decisions
// ------------------------------------------------------------------------------

/**
 * POST /api/v1/vouchers/:id/approve  (Director only)
 *
 * Role is checked FIRST. The workflow then requires PENDING_APPROVAL and an
 * intact Director signature on the same voucher.
 */
vouchersRouter.post(
  '/:id/approve',
  requireAuth,
  requireCsrf,
  validate({ params: idParamSchema }),
  async (req, res, next) => {
    try {
      await assertCanDecideVoucher(req.user!)
      const { id } = req.params as z.infer<typeof idParamSchema>
      sendSuccess(res, await approveVoucher(req.user!, id))
    } catch (error) {
      next(error)
    }
  },
)

/**
 * POST /api/v1/vouchers/:id/reject  (Director only)
 *
 * Narrow body: a single validated reason. Status/actor fields cannot be sent.
 */
vouchersRouter.post(
  '/:id/reject',
  requireAuth,
  requireCsrf,
  validate({ params: idParamSchema, body: rejectVoucherSchema }),
  async (req, res, next) => {
    try {
      await assertCanDecideVoucher(req.user!)
      const { id } = req.params as z.infer<typeof idParamSchema>
      const { reason } = req.body as z.infer<typeof rejectVoucherSchema>
      sendSuccess(res, await rejectVoucher(req.user!, id, reason))
    } catch (error) {
      next(error)
    }
  },
)

// ------------------------------------------------------------------------------
// Workflow history
// ------------------------------------------------------------------------------

/** GET /api/v1/vouchers/:id/events - sanitized timeline. */
vouchersRouter.get(
  '/:id/events',
  requireAuth,
  validate({ params: idParamSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as z.infer<typeof idParamSchema>
      await loadVoucherForRead(req.user!, id)
      sendSuccess(res, await getVoucherEvents(id))
    } catch (error) {
      next(error)
    }
  },
)

