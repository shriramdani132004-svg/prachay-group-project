import type { PrismaClient } from '../../lib/prisma.js'

/**
 * Collision-safe voucher numbering.
 *
 * Allocation comes from a dedicated PostgreSQL sequence (see the migration),
 * never from `MAX(voucherNumber) + 1`, which would race under concurrency.
 * `nextval()` is atomic, so concurrent callers always receive distinct values.
 *
 * Format (permitted by ARCHITECTURE.md section 6.1): VCH-<year>-<6 digits>
 * e.g. VCH-2026-000001
 *
 * Assumptions:
 * - Sequence gaps after a rolled-back transaction are acceptable; duplicates are not.
 * - The sequence is never reset by ordinary seeding.
 * - The year is derived from the server clock at allocation time.
 */

const VOUCHER_NUMBER_SEQUENCE = 'voucher_number_seq'
const PREFIX = 'VCH'
const SEQUENCE_DIGITS = 6

/** Formats a raw sequence value into the canonical voucher number. */
export function formatVoucherNumber(sequenceValue: bigint | number, year: number): string {
  return `${PREFIX}-${year}-${String(sequenceValue).padStart(SEQUENCE_DIGITS, '0')}`
}

/** Parses a voucher number back into its parts. Used by tests and tooling. */
export function parseVoucherNumber(voucherNumber: string): { year: number; sequence: number } | null {
  const match = /^VCH-(\d{4})-(\d{6,})$/.exec(voucherNumber)
  if (!match) return null

  return { year: Number(match[1]), sequence: Number(match[2]) }
}

/**
 * Allocates the next voucher number from PostgreSQL.
 *
 * Uses a raw statement rather than the Prisma query builder because sequences
 * are not modelled by Prisma.
 *
 * `$queryRaw` is deliberately NOT used here: Prisma parameterizes tagged
 * templates, so the sequence name would become `$1` and PostgreSQL would fail
 * with `relation "$1" does not exist` - `nextval()` requires a literal
 * identifier. The interpolated value is a module-level constant, never any
 * kind of user input, so inlining it is safe here.
 */
export async function allocateVoucherNumber(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<string> {
  const rows = await prisma.$queryRawUnsafe<{ next_value: bigint }[]>(
    `SELECT nextval('${VOUCHER_NUMBER_SEQUENCE}') AS next_value`,
  )

  const raw = rows[0]?.next_value
  if (raw === undefined) {
    throw new Error('Failed to allocate a voucher number: sequence returned no value.')
  }

  return formatVoucherNumber(raw, now.getUTCFullYear())
}