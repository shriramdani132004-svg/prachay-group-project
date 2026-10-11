import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'
import { env } from '../config/env.js'

/**
 * Single Prisma client instance per application process.
 *
 * Prisma 7 requires an explicit driver adapter; we use the official
 * `@prisma/adapter-pg` PostgreSQL adapter with the `pg` driver.
 */
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })

export const prisma = new PrismaClient({
  adapter,
  log: env.isDevelopment ? ['warn', 'error'] : ['error'],
})

/**
 * Verifies real database connectivity.
 *
 * Used by the health/readiness endpoints. Intentionally performs an actual
 * round-trip so an unreachable database can never be reported as healthy.
 */
export async function checkDatabaseConnection(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect()
}

export type { PrismaClient }