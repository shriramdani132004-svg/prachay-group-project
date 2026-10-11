import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, UserRole } from '../src/generated/prisma/client.js'
import { hashPassword } from '../src/services/password.service.js'

/**
 * Local demo-account provisioning (Phase 4).
 *
 * SAFETY RULES enforced here:
 * - Refuses to run when NODE_ENV=production.
 * - Requires an explicit DEMO_AUTH_ENABLED=true.
 * - Requires four INDEPENDENTLY supplied strong passwords. There is no default,
 *   documented or otherwise.
 * - Only touches existing seeded identities under the reserved @pspl.test domain.
 * - Never assigns or changes a role.
 * - Never prints a password or a hash.
 * - Idempotent for the same supplied configuration.
 *
 * Phase 3 seeded these identities deliberately WITHOUT password hashes, so an
 * unprovisioned account fails login cleanly rather than having a weak default.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

const MIN_PASSWORD_LENGTH = 12

/** Maps the seeded identities to the environment variables that set their password. */
const DEMO_ACCOUNTS: { email: string; expectedRole: UserRole; passwordVar: string }[] = [
  {
    email: 'rajesh.kumar@pspl.test',
    expectedRole: UserRole.EMPLOYEE,
    passwordVar: 'DEMO_EMPLOYEE_1_PASSWORD',
  },
  {
    email: 'priya.sharma@pspl.test',
    expectedRole: UserRole.EMPLOYEE,
    passwordVar: 'DEMO_EMPLOYEE_2_PASSWORD',
  },
  {
    email: 'arun.patel@pspl.test',
    expectedRole: UserRole.DIRECTOR,
    passwordVar: 'DEMO_DIRECTOR_PASSWORD',
  },
  {
    email: 'meera.nair@pspl.test',
    expectedRole: UserRole.ACCOUNTS,
    passwordVar: 'DEMO_ACCOUNTS_PASSWORD',
  },
]

export interface ProvisionResult {
  provisioned: string[]
  unchanged: string[]
}

/**
 * Pure validation of the provisioning preconditions.
 *
 * Exported so its safety rules can be unit tested without touching a database.
 */
export function validateProvisioningPreconditions(
  nodeEnv: string | undefined,
  demoAuthEnabled: string | undefined,
  passwordProvider: (name: string) => string | undefined = (n) => process.env[n],
): { ok: true } | { ok: false; reasons: string[] } {
  const reasons: string[] = []

  if (nodeEnv === 'production') {
    reasons.push('Refusing to run: NODE_ENV=production. Demo provisioning is development-only.')
  }

  if (demoAuthEnabled !== 'true') {
    reasons.push('Refusing to run: DEMO_AUTH_ENABLED must be explicitly set to true.')
  }

  for (const account of DEMO_ACCOUNTS) {
    const value = passwordProvider(account.passwordVar)

    if (!value || value.length === 0) {
      reasons.push(`${account.passwordVar} is missing. Supply a unique password for ${account.email}.`)
      continue
    }

    if (value.length < MIN_PASSWORD_LENGTH) {
      reasons.push(
        `${account.passwordVar} must be at least ${MIN_PASSWORD_LENGTH} characters (independently supplied).`,
      )
    }
  }

  // Each demo account must have a DISTINCT password so one leaked credential
  // cannot unlock every role.
  const seen = new Map<string, string>()
  for (const account of DEMO_ACCOUNTS) {
    const value = passwordProvider(account.passwordVar)
    if (!value) continue
    const previous = seen.get(value)
    if (previous) {
      reasons.push(`${account.passwordVar} must differ from ${previous}.`)
    } else {
      seen.set(value, account.passwordVar)
    }
  }

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons }
}

/**
 * Hashes and stores demo passwords for the seeded identities.
 *
 * Uses the same production hashing service as the login path.
 */
export async function provisionDemoAccounts(
  passwordProvider: (name: string) => string | undefined = (n) => process.env[n],
): Promise<ProvisionResult> {
  const result: ProvisionResult = { provisioned: [], unchanged: [] }

  // Resolve every identity up-front so a missing seed is a hard failure.
  const users = await prisma.user.findMany({
    where: { email: { in: DEMO_ACCOUNTS.map((a) => a.email) } },
    select: { id: true, email: true, role: true },
  })

  const byEmail = new Map(users.map((u) => [u.email, u]))

  for (const account of DEMO_ACCOUNTS) {
    const user = byEmail.get(account.email)

    if (!user) {
      throw new Error(
        `Demo identity ${account.email} does not exist. Run "npm run prisma:seed" before provisioning.`,
      )
    }

    // A role mismatch means the seed changed; refuse rather than silently adapt.
    if (user.role !== account.expectedRole) {
      throw new Error(
        `Demo identity ${account.email} has role ${user.role} but provisioning expects ${account.expectedRole}. Refusing to continue.`,
      )
    }

    const password = passwordProvider(account.passwordVar)
    if (!password) {
      throw new Error(`${account.passwordVar} is missing.`)
    }

    const passwordHash = await hashPassword(password)

    // Only the hash is written. Role is deliberately never included.
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })

    result.provisioned.push(account.email)
  }

  return result
}

/** CLI entry point. */
async function main(): Promise<void> {
  const preconditions = validateProvisioningPreconditions(
    process.env.NODE_ENV,
    process.env.DEMO_AUTH_ENABLED,
  )

  if (!preconditions.ok) {
    console.error('Demo provisioning refused:')
    for (const reason of preconditions.reasons) console.error(`  - ${reason}`)
    console.error('\nSet DEMO_AUTH_ENABLED=true and four distinct demo passwords in server/.env.')
    process.exitCode = 1
    return
  }

  const result = await provisionDemoAccounts()

  // Emails and counts only - never a password or a hash.
  console.log('Demo accounts provisioned:')
  for (const email of result.provisioned) console.log(`  - ${email}`)
  console.log(`Total: ${result.provisioned.length}. No credentials were printed.`)
}

// Only run when executed directly, so the module stays importable by tests.
const isDirectRun = process.argv[1]?.includes('provision-demo')

if (isDirectRun) {
  main()
    .catch((error) => {
      console.error('Demo provisioning failed:', error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}