import { Router } from 'express'
import { prisma } from '../../lib/prisma.js'
import { sendPaginated } from '../../common/types/response.js'
import { buildPaginationMeta, normalizePagination } from '../../common/pagination/pagination.js'
import { requireAuth } from '../../middleware/require-auth.js'

export const departmentsRouter = Router()

const SORTABLE = ['name', 'code', 'createdAt'] as const
type DepartmentSortKey = (typeof SORTABLE)[number]

/**
 * GET /api/v1/departments
 *
 * Returns active department reference data straight from PostgreSQL.
 *
 * Phase 4 made this authenticated: it is organization metadata used to build
 * voucher forms, and it must not be readable by anonymous callers.
 */
departmentsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const pagination = normalizePagination<DepartmentSortKey>(
      req.query as Record<string, unknown>,
      SORTABLE,
      'name',
    )

    const where = { isActive: true }

    const [items, totalItems] = await Promise.all([
      prisma.department.findMany({
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
      prisma.department.count({ where }),
    ])

    sendPaginated(res, items, buildPaginationMeta(pagination.page, pagination.pageSize, totalItems))
  } catch (error) {
    next(error)
  }
})