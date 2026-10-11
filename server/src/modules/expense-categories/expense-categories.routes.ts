import { Router } from 'express'
import { prisma } from '../../lib/prisma.js'
import { sendPaginated } from '../../common/types/response.js'
import { buildPaginationMeta, normalizePagination } from '../../common/pagination/pagination.js'
import { requireAuth } from '../../middleware/require-auth.js'

export const expenseCategoriesRouter = Router()

const SORTABLE = ['name', 'code', 'createdAt'] as const
type CategorySortKey = (typeof SORTABLE)[number]

/**
 * GET /api/v1/expense-categories
 *
 * Returns active expense-category reference data straight from PostgreSQL.
 *
 * Phase 4 made this authenticated: it is organization metadata and must not be
 * readable by anonymous callers.
 */
expenseCategoriesRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const pagination = normalizePagination<CategorySortKey>(
      req.query as Record<string, unknown>,
      SORTABLE,
      'name',
    )

    const where = { isActive: true }

    const [items, totalItems] = await Promise.all([
      prisma.expenseCategory.findMany({
        where,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
        skip: pagination.skip,
        take: pagination.take,
        select: {
          id: true,
          code: true,
          name: true,
          createdAt: true,
        },
      }),
      prisma.expenseCategory.count({ where }),
    ])

    sendPaginated(res, items, buildPaginationMeta(pagination.page, pagination.pageSize, totalItems))
  } catch (error) {
    next(error)
  }
})