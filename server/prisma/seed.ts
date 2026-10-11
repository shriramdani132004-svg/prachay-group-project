import 'dotenv/config'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  Prisma,
  PrismaClient,
  SignatureType,
  VoucherEventType,
  VoucherStatus,
  UserRole,
} from '../src/generated/prisma/client.js'

/**
 * Idempotent development seed.
 *
 * Every record is created with a stable natural key and upserted, so running
 * this repeatedly never duplicates departments, categories, users or vouchers.
 * No real personal information and no usable passwords are seeded: accounts are
 * fixtures until Phase 4 implements authentication (provision-demo.ts).
 *
 * Phase 9 extension:
 * - Refuses to run when NODE_ENV=production.
 * - Seeds vouchers across the whole lifecycle (DRAFT, PENDING_APPROVAL,
 *   APPROVED, REJECTED) with synthetic, obviously-fake signature images stored
 *   in the PRIVATE signature vault (same directory the app streams from).
 *   Signature bytes are a constant 1x1 PNG — never real biometric data.
 */

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed: NODE_ENV=production. The seed is development-only.')
  process.exit(1)
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

/** Private vault root used by the application for signature streaming. */
const SIGNATURE_STORAGE_DIR = path.resolve(
  process.cwd(),
  process.env.SIGNATURE_STORAGE_DIR ?? './storage/signatures',
)

/**
 * Constant synthetic 1x1 PNG used for every seeded signature.
 * Deliberately fake: a solid pixel, not a real person's signature.
 */
const SYNTHETIC_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

/** Departments mirror the Phase 2 frontend demo-data terminology. */
const departments = [
  { code: 'EQT', name: 'Equity Trading' },
  { code: 'INV', name: 'Investment Banking' },
  { code: 'CMP', name: 'Compliance' },
  { code: 'OPS', name: 'Operations' },
  { code: 'IT', name: 'IT' },
  { code: 'RES', name: 'Research' },
]

/** Expense categories mirror the Phase 2 frontend demo-data terminology. */
const expenseCategories = [
  { code: 'TRV', name: 'Travel' },
  { code: 'CLE', name: 'Client Entertainment' },
  { code: 'OFS', name: 'Office Supplies' },
  { code: 'SFW', name: 'Software' },
  { code: 'UTL', name: 'Utilities' },
  { code: 'SUB', name: 'Subscriptions' },
  { code: 'MSC', name: 'Miscellaneous' },
]

/**
 * Development fixture identities.
 * Emails use the reserved `.test` TLD (RFC 6761) so they can never route.
 * `passwordHash` is intentionally omitted: Phase 4 provisions credentials.
 */
const users = [
  {
    email: 'rajesh.kumar@pspl.test',
    fullName: 'Rajesh Kumar',
    role: UserRole.EMPLOYEE,
    employeeId: 'EMP-001',
    departmentCode: 'EQT',
  },
  {
    email: 'priya.sharma@pspl.test',
    fullName: 'Priya Sharma',
    role: UserRole.EMPLOYEE,
    employeeId: 'EMP-002',
    departmentCode: 'INV',
  },
  {
    email: 'arun.patel@pspl.test',
    fullName: 'Arun Patel',
    role: UserRole.DIRECTOR,
    employeeId: 'DIR-001',
    departmentCode: 'OPS',
  },
  {
    email: 'meera.nair@pspl.test',
    fullName: 'Meera Nair',
    role: UserRole.ACCOUNTS,
    employeeId: 'ACC-001',
    departmentCode: 'OPS',
  },
]

/**
 * Development seed vouchers across the whole lifecycle.
 *
 * Each entry's `reference` is its stable natural key (stored in the CREATED
 * event metadata). Signatures are synthetic 1x1 PNGs written to the private
 * vault; the Signature rows record the same sha256/size the app would store
 * for a real upload.
 */
interface SeedVoucher {
  reference: string
  email: string
  departmentCode: string
  categoryCode: string
  expenseTitle: string
  expenseDescription: string
  amount: string
  expenseDate: string
  status: VoucherStatus
  /** Employee signature present (true for every non-draft voucher). */
  employeeSigned?: boolean
  /** Director signature present (true for APPROVED/REJECTED). */
  directorSigned?: boolean
  /** Approver/rejecter identity email (DIRECTOR). */
  reviewerEmail?: string
  rejectionReason?: string
}

const vouchers: SeedVoucher[] = [
  {
    reference: 'seed-draft-1',
    email: 'rajesh.kumar@pspl.test',
    departmentCode: 'EQT',
    categoryCode: 'TRV',
    expenseTitle: 'Client Meeting - Mumbai',
    expenseDescription: 'Travel and meeting costs for the Mumbai client review.',
    amount: '45000.00',
    expenseDate: '2026-09-28',
    status: VoucherStatus.DRAFT,
  },
  {
    reference: 'seed-draft-2',
    email: 'rajesh.kumar@pspl.test',
    departmentCode: 'EQT',
    categoryCode: 'CLE',
    expenseTitle: 'Team Lunch - Quarterly Review',
    expenseDescription: 'Quarterly team review lunch with the trading desk.',
    amount: '18500.00',
    expenseDate: '2026-10-05',
    status: VoucherStatus.DRAFT,
  },
  {
    reference: 'seed-draft-3',
    email: 'priya.sharma@pspl.test',
    departmentCode: 'INV',
    categoryCode: 'SFW',
    expenseTitle: 'Cloud Infrastructure - AWS',
    expenseDescription: 'Monthly cloud hosting for the deal pipeline tooling.',
    amount: '210000.00',
    expenseDate: '2026-10-07',
    status: VoucherStatus.DRAFT,
  },
  {
    reference: 'seed-draft-4',
    email: 'priya.sharma@pspl.test',
    departmentCode: 'INV',
    categoryCode: 'OFS',
    expenseTitle: 'Office Supplies - Q4 Restock',
    expenseDescription: 'Quarterly restock of department office supplies.',
    amount: '32000.00',
    expenseDate: '2026-10-06',
    status: VoucherStatus.DRAFT,
  },
  {
    reference: 'seed-draft-5',
    email: 'rajesh.kumar@pspl.test',
    departmentCode: 'CMP',
    categoryCode: 'MSC',
    expenseTitle: 'Regulatory Filing Fees',
    expenseDescription: 'Statutory filing fees for the quarterly compliance cycle.',
    amount: '75000.00',
    expenseDate: '2026-10-03',
    status: VoucherStatus.DRAFT,
  },
  {
    reference: 'seed-pending-1',
    email: 'rajesh.kumar@pspl.test',
    departmentCode: 'EQT',
    categoryCode: 'TRV',
    expenseTitle: 'Client Site Visit - Pune',
    expenseDescription: 'Train fare and local travel for the Pune plant audit.',
    amount: '12750.50',
    expenseDate: '2026-10-01',
    status: VoucherStatus.PENDING_APPROVAL,
    employeeSigned: true,
  },
  {
    reference: 'seed-pending-2',
    email: 'priya.sharma@pspl.test',
    departmentCode: 'INV',
    categoryCode: 'SUB',
    expenseTitle: 'Market Data Terminal Renewal',
    expenseDescription: 'Annual renewal of the Bloomberg terminal subscription.',
    amount: '89000.00',
    expenseDate: '2026-10-02',
    status: VoucherStatus.PENDING_APPROVAL,
    employeeSigned: true,
  },
  {
    reference: 'seed-approved-1',
    email: 'rajesh.kumar@pspl.test',
    departmentCode: 'EQT',
    categoryCode: 'TRV',
    expenseTitle: 'Client Meeting - Delhi',
    expenseDescription: 'Travel and meeting costs for the Delhi institutional review.',
    amount: '34500.00',
    expenseDate: '2026-09-20',
    status: VoucherStatus.APPROVED,
    employeeSigned: true,
    directorSigned: true,
    reviewerEmail: 'arun.patel@pspl.test',
  },
  {
    reference: 'seed-approved-2',
    email: 'priya.sharma@pspl.test',
    departmentCode: 'INV',
    categoryCode: 'CLE',
    expenseTitle: 'Investor Dinner - Bengaluru',
    expenseDescription: 'Dinner hosting for the Bengaluru investor roadshow.',
    amount: '27800.00',
    expenseDate: '2026-09-25',
    status: VoucherStatus.APPROVED,
    employeeSigned: true,
    directorSigned: true,
    reviewerEmail: 'arun.patel@pspl.test',
  },
  {
    reference: 'seed-rejected-1',
    email: 'rajesh.kumar@pspl.test',
    departmentCode: 'CMP',
    categoryCode: 'MSC',
    expenseTitle: 'Conference Ticket - Hyderabad',
    expenseDescription: 'Ticket for the national compliance conference.',
    amount: '15000.00',
    expenseDate: '2026-09-18',
    status: VoucherStatus.REJECTED,
    employeeSigned: true,
    directorSigned: true,
    reviewerEmail: 'arun.patel@pspl.test',
    rejectionReason: 'Please attach the approval memo from the compliance head before resubmitting.',
  },
]

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

async function main(): Promise<void> {
  console.log('Seeding PSPL voucher development data...')

  // --- Departments (upsert on the unique code) -----------------------------
  for (const dept of departments) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name, isActive: true },
      create: { code: dept.code, name: dept.name },
    })
  }
  console.log(`  departments: ${departments.length}`)

  // --- Expense categories ---------------------------------------------------
  for (const category of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { code: category.code },
      update: { name: category.name, isActive: true },
      create: { code: category.code, name: category.name },
    })
  }
  console.log(`  expense categories: ${expenseCategories.length}`)

  // --- Users ----------------------------------------------------------------
  const departmentByCode = new Map(
    (await prisma.department.findMany({ select: { id: true, code: true } })).map((d) => [
      d.code,
      d.id,
    ]),
  )

  const userIdsByEmail = new Map<string, string>()

  for (const user of users) {
    const email = normalizeEmail(user.email)

    const record = await prisma.user.upsert({
      where: { email },
      update: {
        fullName: user.fullName,
        role: user.role,
        employeeId: user.employeeId,
        departmentId: departmentByCode.get(user.departmentCode) ?? null,
        isActive: true,
      },
      create: {
        email,
        fullName: user.fullName,
        role: user.role,
        employeeId: user.employeeId,
        departmentId: departmentByCode.get(user.departmentCode) ?? null,
        // No passwordHash: these are fixtures until Phase 4.
        passwordHash: null,
      },
      select: { id: true, employeeId: true },
    })

    userIdsByEmail.set(email, record.id)
  }
  console.log(`  users: ${users.length} (roles: EMPLOYEE, DIRECTOR, ACCOUNTS)`)

  // --- Vouchers -------------------------------------------------------------
  const categoryByCode = new Map(
    (await prisma.expenseCategory.findMany({ select: { id: true, code: true } })).map((c) => [
      c.code,
      c.id,
    ]),
  )

  const departmentByName = new Map(
    (await prisma.department.findMany({ select: { id: true, code: true, name: true } })).map(
      (d) => [d.code, d],
    ),
  )

  for (const voucher of vouchers) {
    const email = normalizeEmail(voucher.email)
    const createdById = userIdsByEmail.get(email)
    if (!createdById) throw new Error(`Seed error: no seeded user for ${email}`)

    const departmentId = departmentByName.get(voucher.departmentCode)?.id
    const expenseCategoryId = categoryByCode.get(voucher.categoryCode)
    if (!departmentId || !expenseCategoryId) {
      throw new Error(`Seed error: unresolved reference data for ${voucher.reference}`)
    }

    const expenseDate = new Date(`${voucher.expenseDate}T00:00:00.000Z`)
    const submittedAt =
      voucher.status === VoucherStatus.DRAFT ? null : new Date(`${voucher.expenseDate}T09:00:00.000Z`)
    const reviewedById = voucher.reviewerEmail
      ? userIdsByEmail.get(normalizeEmail(voucher.reviewerEmail)) ?? null
      : null
    const approvedAt =
      voucher.status === VoucherStatus.APPROVED ? new Date(`${voucher.expenseDate}T17:00:00.000Z`) : null
    const rejectedAt =
      voucher.status === VoucherStatus.REJECTED ? new Date(`${voucher.expenseDate}T17:00:00.000Z`) : null

    const existing = await prisma.voucher.findFirst({
      where: { createdById, expenseTitle: voucher.expenseTitle, expenseDate },
    })

    let voucherId: string

    if (existing) {
      // Already seeded: refresh mutable fields idempotently.
      await prisma.voucher.update({
        where: { id: existing.id },
        data: {
          amount: voucher.amount,
          departmentId,
          expenseCategoryId,
          expenseDescription: voucher.expenseDescription,
        },
      })
      voucherId = existing.id
    } else {
      const created = await prisma.voucher.create({
        data: {
          voucherNumber: await allocateVoucherNumber(),
          voucherDate: expenseDate,
          expenseDate,
          departmentId,
          expenseTitle: voucher.expenseTitle,
          expenseCategoryId,
          expenseDescription: voucher.expenseDescription,
          amount: voucher.amount,
          currency: 'INR',
          createdById,
          employeeIdSnapshot: users.find((u) => normalizeEmail(u.email) === email)?.employeeId ?? null,
          employeeNameSnapshot: users.find((u) => normalizeEmail(u.email) === email)?.fullName ?? null,
          status: voucher.status,
          submittedAt,
          reviewedById,
          approvedAt,
          rejectedAt,
          rejectionReason: voucher.rejectionReason ?? null,
        },
      })
      voucherId = created.id
    }

    // --- Audit trail (idempotent per voucher+type) --------------------------
    const desiredEvents: {
      type: VoucherEventType
      actorId: string
      fromStatus: VoucherStatus | null
      toStatus: VoucherStatus
      metadata?: Prisma.InputJsonValue
    }[] = [
      {
        type: VoucherEventType.CREATED,
        actorId: createdById,
        fromStatus: null,
        toStatus: VoucherStatus.DRAFT,
        metadata: { source: 'development-seed', reference: voucher.reference },
      },
    ]
    if (voucher.status !== VoucherStatus.DRAFT) {
      desiredEvents.push(
        {
          type: VoucherEventType.SUBMITTED,
          actorId: createdById,
          fromStatus: VoucherStatus.DRAFT,
          toStatus: VoucherStatus.PENDING_APPROVAL,
        },
        {
          type: VoucherEventType.PENDING_APPROVAL,
          actorId: createdById,
          fromStatus: VoucherStatus.DRAFT,
          toStatus: VoucherStatus.PENDING_APPROVAL,
        },
      )
    }
    if (voucher.status === VoucherStatus.APPROVED && reviewedById) {
      desiredEvents.push({
        type: VoucherEventType.APPROVED,
        actorId: reviewedById,
        fromStatus: VoucherStatus.PENDING_APPROVAL,
        toStatus: VoucherStatus.APPROVED,
      })
    }
    if (voucher.status === VoucherStatus.REJECTED && reviewedById) {
      desiredEvents.push({
        type: VoucherEventType.REJECTED,
        actorId: reviewedById,
        fromStatus: VoucherStatus.PENDING_APPROVAL,
        toStatus: VoucherStatus.REJECTED,
        metadata: { reason: voucher.rejectionReason },
      })
    }

    const existingEventTypes = new Set(
      (await prisma.voucherEvent.findMany({ where: { voucherId }, select: { type: true } })).map(
        (e) => e.type,
      ),
    )
    for (const event of desiredEvents) {
      if (existingEventTypes.has(event.type)) continue
      await prisma.voucherEvent.create({
        data: {
          voucherId,
          actorId: event.actorId,
          type: event.type,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          metadata: event.metadata ?? undefined,
        },
      })
    }

    // --- Synthetic signatures in the private vault (idempotent) -------------
    const signaturePlan: { type: SignatureType; uploadedById: string }[] = []
    if (voucher.employeeSigned) {
      signaturePlan.push({ type: SignatureType.EMPLOYEE, uploadedById: createdById })
    }
    if (voucher.directorSigned && reviewedById) {
      signaturePlan.push({ type: SignatureType.DIRECTOR, uploadedById: reviewedById })
    }

    for (const plan of signaturePlan) {
      const existingSignature = await prisma.signature.findUnique({
        where: { voucherId_type: { voucherId, type: plan.type } },
      })
      if (existingSignature) continue

      const stored = await storeSyntheticSignature()
      await prisma.signature.create({
        data: {
          voucherId,
          uploadedById: plan.uploadedById,
          type: plan.type,
          storageKey: stored.storageKey,
          mimeType: 'image/png',
          sizeBytes: stored.sizeBytes,
          sha256: stored.sha256,
        },
      })
    }
  }

  console.log(
    `  vouchers: ${vouchers.length} (statuses: DRAFT, PENDING_APPROVAL, APPROVED, REJECTED)`,
  )
  console.log('Seed completed.')

  const [deptCount, categoryCount, userCount, voucherCount] = await Promise.all([
    prisma.department.count(),
    prisma.expenseCategory.count(),
    prisma.user.count(),
    prisma.voucher.count(),
  ])
  console.log(
    `Totals -> departments=${deptCount} categories=${categoryCount} users=${userCount} vouchers=${voucherCount}`,
  )
}

/** Allocates a collision-safe voucher number from the database sequence. */
async function allocateVoucherNumber(): Promise<string> {
  const rows = await prisma.$queryRaw<{ next_value: bigint }[]>`
    SELECT nextval('voucher_number_seq') AS next_value
  `
  const raw = rows[0]?.next_value
  if (raw === undefined) throw new Error('Failed to allocate voucher number from sequence.')

  const year = new Date().getUTCFullYear()
  return `VCH-${year}-${String(raw).padStart(6, '0')}`
}

/**
 * Writes the constant synthetic PNG into the private vault using the same
 * sharded key layout the application's LocalSignatureStorage produces.
 */
async function storeSyntheticSignature(): Promise<{
  storageKey: string
  sizeBytes: number
  sha256: string
}> {
  const fileName = `${randomUUID()}-${randomUUID().replace(/-/g, '').slice(0, 8)}.png`
  const shardA = randomUUID().slice(0, 2)
  const shardB = randomUUID().slice(0, 2)
  const storageKey = path.posix.join(shardA, shardB, fileName)
  const absolutePath = path.join(SIGNATURE_STORAGE_DIR, ...storageKey.split('/'))

  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, SYNTHETIC_PNG, { flag: 'wx' })

  return {
    storageKey,
    sizeBytes: SYNTHETIC_PNG.length,
    sha256: createHash('sha256').update(SYNTHETIC_PNG).digest('hex'),
  }
}

main()
  .catch((error) => {
    console.error('Seed failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })