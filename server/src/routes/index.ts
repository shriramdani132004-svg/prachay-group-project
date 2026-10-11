import { Router } from 'express'
import { healthRouter } from '../modules/health/health.routes.js'
import { departmentsRouter } from '../modules/departments/departments.routes.js'
import { expenseCategoriesRouter } from '../modules/expense-categories/expense-categories.routes.js'
import { authRouter } from '../modules/auth/auth.routes.js'
import { vouchersRouter } from '../modules/vouchers/vouchers.routes.js'
import { signaturesRouter } from '../modules/signatures/signatures.routes.js'

/**
 * API v1 route table.
 *
 * Phase 4 adds real authentication and enforces it on every protected route.
 * The server is the security boundary: a hidden button or a client-side route
 * guard is a UX affordance, never authorization.
 */
export const apiRouter = Router()

// --- Public operational endpoints ------------------------------------------
apiRouter.use('/health', healthRouter)

// --- Authentication ----------------------------------------------------------
apiRouter.use('/auth', authRouter)

// --- Protected: reference data ----------------------------------------------
// Departments and expense categories are organization-wide metadata and require
// an authenticated session (Phase 4 tightened these from Phase 3's public state).
apiRouter.use('/departments', departmentsRouter)
apiRouter.use('/expense-categories', expenseCategoriesRouter)

// --- Protected: business data -----------------------------------------------
// Vouchers also own the analytics sub-routes (/vouchers/analytics/*) and the
// approve/reject decisions (/vouchers/:id/approve|reject).
apiRouter.use('/vouchers', vouchersRouter)
apiRouter.use('/signatures', signaturesRouter)