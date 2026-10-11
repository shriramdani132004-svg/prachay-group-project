import { createHash } from 'node:crypto'
import { ApiError } from '../../common/errors/api-error.js'
import { prisma } from '../../lib/prisma.js'
import { env } from '../../config/env.js'
import { LocalSignatureStorage } from './signature-storage.js'
import type { SignatureType } from '../../generated/prisma/enums.js'

/**
 * Signature persistence workflow (Phases 5 & 6).
 *
 * Rules enforced here, on top of the byte-level validation already provided by
 * LocalSignatureStorage:
 * - At most ONE current signature per (voucher, type) - the DB unique
 *   constraint `uq_signature_voucher_type` is the source of truth.
 * - Replacement is compensating: the new file is written FIRST, the metadata
 *   row is switched, and only then is the old file removed. A failure between
 *   steps never leaves the voucher without its previously valid signature, and
 *   a failed metadata write removes the just-written orphan file.
 * - `verifySignatureUsable` proves the metadata row and the private file agree
 *   (exists, size matches, SHA-256 matches) before submission or approval may
 *   depend on the signature.
 */

function storage(): LocalSignatureStorage {
  return new LocalSignatureStorage(env.signatureStoragePath, env.MAX_SIGNATURE_FILE_SIZE_BYTES)
}

export interface SignatureRecord {
  id: string
  voucherId: string
  type: SignatureType
  uploadedById: string
  mimeType: string
  sizeBytes: number
  sha256: string
  createdAt: Date
}

/** Sanitized metadata - the storage key NEVER leaves this module. */
export function toSignatureMetadata(row: {
  id: string
  type: SignatureType
  mimeType: string
  sizeBytes: number
  createdAt: Date
}) {
  return {
    id: row.id,
    type: row.type,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Stores the uploaded bytes and associates them with the voucher.
 *
 * First upload creates a row; a repeat upload of the same type REPLACES the
 * previous signature atomically from the API consumer's point of view.
 */
export async function upsertVoucherSignature(params: {
  voucherId: string
  type: SignatureType
  uploadedById: string
  buffer: Buffer
}): Promise<SignatureRecord> {
  const { voucherId, type, uploadedById, buffer } = params
  const vault = storage()

  // 1. Validate + write the NEW file first; the old one is untouched yet.
  const stored = await vault.store(buffer)

  try {
    const existing = await prisma.signature.findUnique({
      where: { voucherId_type: { voucherId, type } },
      select: { id: true, storageKey: true },
    })

    const row = existing
      ? await prisma.signature.update({
          where: { id: existing.id },
          data: {
            uploadedById,
            storageKey: stored.storageKey,
            mimeType: stored.mimeType,
            sizeBytes: stored.sizeBytes,
            sha256: stored.sha256,
          },
        })
      : await prisma.signature.create({
          data: {
            voucherId,
            type,
            uploadedById,
            storageKey: stored.storageKey,
            mimeType: stored.mimeType,
            sizeBytes: stored.sizeBytes,
            sha256: stored.sha256,
          },
        })

    // 2. Metadata now points at the new file - only now remove the old one.
    if (existing && existing.storageKey !== stored.storageKey) {
      await vault.remove(existing.storageKey).catch(() => undefined)
    }

    return row
  } catch (error) {
    // Compensating cleanup: the row was not switched, so the new file is an
    // unreferenced orphan. Remove it; the previous signature stays valid.
    await vault.remove(stored.storageKey).catch(() => undefined)
    throw error
  }
}

/**
 * Proves a signature row is usable: the private file exists, matches the
 * recorded size and matches the recorded SHA-256 digest.
 *
 * Used by submission (Phase 5) and approval (Phase 6) so a missing, truncated
 * or corrupted file can never satisfy a workflow requirement.
 */
export async function verifySignatureUsable(row: {
  storageKey: string
  sizeBytes: number
  sha256: string
}): Promise<boolean> {
  try {
    const bytes = await storage().read(row.storageKey)
    if (bytes.length !== row.sizeBytes) return false

    const digest = createHash('sha256').update(bytes).digest('hex')
    return digest === row.sha256
  } catch {
    return false
  }
}

/** Loads the stored bytes for an already-authorized signature row. */
export async function readSignatureBytes(storageKey: string): Promise<Buffer> {
  return storage().read(storageKey)
}

/** Best-effort removal of every signature file+row belonging to one voucher. */
export async function deleteVoucherSignatures(voucherId: string): Promise<void> {
  const rows = await prisma.signature.findMany({
    where: { voucherId },
    select: { id: true, storageKey: true },
  })
  if (rows.length === 0) return

  await prisma.signature.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } })

  const vault = storage()
  await Promise.all(rows.map((r) => vault.remove(r.storageKey).catch(() => undefined)))
}

/** Loads a signature by id, scoped to one voucher. Used by the stream route. */
export async function loadSignatureForVoucher(
  voucherId: string,
  type: SignatureType,
): Promise<(SignatureRecord & { storageKey: string }) | null> {
  return prisma.signature.findUnique({
    where: { voucherId_type: { voucherId, type } },
  })
}

/** Convenience error used when a workflow precondition on signatures fails. */
export function signatureMissingError(type: SignatureType): ApiError {
  const label = type === 'EMPLOYEE' ? 'employee' : 'director'
  return ApiError.unprocessable(`A valid ${label} signature is required for this action.`)
}
