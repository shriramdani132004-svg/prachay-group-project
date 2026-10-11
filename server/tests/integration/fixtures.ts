import crypto from 'node:crypto'
import { env } from '../../src/config/env.js'

/**
 * Integration-test fixtures.
 *
 * Creates uniquely identified temporary users/vouchers owned by THIS test file
 * and cleans up ONLY those records. Never truncates tables and never touches
 * the Phase 3 development seed records.
 */

export const TEST_DOMAIN = 'auth-test.pspl.test'

export interface FixtureUser {
  id: string
  email: string
  fullName: string
  role: 'EMPLOYEE' | 'DIRECTOR' | 'ACCOUNTS'
  password: string
}

let runId = crypto.randomBytes(4).toString('hex')

/** Unique per run so repeated runs never collide with earlier fixtures. */
export function uniqueSuffix(): string {
  return `${runId}-${crypto.randomBytes(3).toString('hex')}`
}

export async function createFixtureUser(
  role: 'EMPLOYEE' | 'DIRECTOR' | 'ACCOUNTS',
  password: string,
): Promise<FixtureUser> {
  const { prisma } = await import('../../src/lib/prisma.js')
  const { hashPassword } = await import('../../src/services/password.service.js')

  const suffix = uniqueSuffix()
  const email = `${role.toLowerCase()}.${suffix}@${TEST_DOMAIN}`

  const user = await prisma.user.create({
    data: {
      email,
      fullName: `Test ${role} ${suffix}`,
      role,
      employeeId: `T-${role}-${suffix}`,
      passwordHash: await hashPassword(password),
      isActive: true,
    },
    select: { id: true, email: true, fullName: true, role: true },
  })

  return { ...user, role, password } as FixtureUser
}

/** Creates a voucher owned by `userId` with the given status. */
export async function createFixtureVoucher(
  userId: string,
  status: 'DRAFT' | 'SUBMITTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' = 'DRAFT',
  reviewedById?: string,
): Promise<{ id: string; createdById: string; status: string }> {
  const { prisma } = await import('../../src/lib/prisma.js')
  const { allocateVoucherNumber } = await import('../../src/modules/vouchers/voucher-number.service.js')

  const department = await prisma.department.findFirst({ select: { id: true } })
  const category = await prisma.expenseCategory.findFirst({ select: { id: true } })
  if (!department || !category) throw new Error('Reference data missing; run the seed first.')

  const voucherNumber = await allocateVoucherNumber(prisma)
  const now = new Date()

  const voucher = await prisma.voucher.create({
    data: {
      voucherNumber,
      voucherDate: now,
      expenseDate: now,
      departmentId: department.id,
      expenseTitle: `Auth test voucher ${uniqueSuffix()}`,
      expenseCategoryId: category.id,
      expenseDescription: 'Created by an automated authorization test.',
      amount: '1000.00',
      createdById: userId,
      status,
      // chk_vouchers_approved_has_reviewer requires a reviewer for APPROVED.
      ...(status === 'APPROVED'
        ? { approvedAt: now, reviewedById: reviewedById ?? userId }
        : {}),
      ...(status === 'REJECTED'
        ? { rejectedAt: now, rejectionReason: 'Automated test rejection' }
        : {}),
      ...(status === 'SUBMITTED' || status === 'PENDING_APPROVAL' ? { submittedAt: now } : {}),
    },
    select: { id: true, createdById: true, status: true },
  })

  return voucher
}

/**
 * Deletes ONLY this run's fixtures.
 *
 * Scoped by the reserved test email domain and by the voucher ids created here,
 * so seeded development data is never affected.
 */
export async function cleanupFixtures(userIds: string[], voucherIds: string[] = []): Promise<void> {
  const { prisma } = await import('../../src/lib/prisma.js')

  if (voucherIds.length > 0) {
    await prisma.voucher.deleteMany({ where: { id: { in: voucherIds } } })
  }

  if (userIds.length > 0) {
    // Sessions cascade from users.
    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.voucher.deleteMany({ where: { createdById: { in: userIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  }
}

/** Cookie header value carrying the session cookie from a Supertest response. */
export function sessionCookieHeader(setCookie: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
  return cookies.map((c) => c.split(';')[0]).join('; ')
}

export function sessionCookieName(): string {
  return env.sessionCookieName
}