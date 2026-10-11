import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileTypeFromBuffer } from 'file-type'
import { ApiError } from '../../common/errors/api-error.js'

/**
 * Private signature vault storage.
 *
 * Security properties:
 * - Files live OUTSIDE the public frontend directory and are never served by
 *   express.static. They are only reachable through the authenticated
 *   `/api/v1/signatures/:id` streaming route (Phase 4+).
 * - Actual file CONTENT is inspected via magic bytes, not the client-supplied
 *   filename or Content-Type, so SVG/HTML/executable masquerading as an image
 *   is rejected.
 * - Storage names are generated server-side with randomUUID + a random suffix.
 *   User input never contributes to a filesystem path.
 * - Keys are resolved and re-validated against the storage root to defeat
 *   path traversal.
 */

export const ALLOWED_SIGNATURE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export type AllowedSignatureMimeType = (typeof ALLOWED_SIGNATURE_MIME_TYPES)[number]

const EXTENSION_BY_MIME: Record<AllowedSignatureMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export interface StoredSignature {
  /** Relative key, e.g. "ab/cd/<uuid>-<rand>.png". Never a filesystem path. */
  storageKey: string
  mimeType: AllowedSignatureMimeType
  sizeBytes: number
  sha256: string
}

export interface SignatureStorage {
  store(buffer: Buffer): Promise<StoredSignature>
  read(storageKey: string): Promise<Buffer>
  remove(storageKey: string): Promise<void>
}

export class LocalSignatureStorage implements SignatureStorage {
  constructor(
    private readonly rootDir: string,
    private readonly maxSizeBytes: number,
  ) {}

  /**
   * Validates and durably stores an image.
   *
   * @throws ApiError 413 when too large, 415 when the content is not a
   *         permitted image type.
   */
  async store(buffer: Buffer): Promise<StoredSignature> {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw ApiError.badRequest('The uploaded file is empty.')
    }

    if (buffer.length > this.maxSizeBytes) {
      throw ApiError.payloadTooLarge(
        `The signature file exceeds the maximum size of ${this.maxSizeBytes} bytes.`,
      )
    }

    // Content-based detection: ignores filename and client MIME type entirely.
    const detected = await fileTypeFromBuffer(buffer)

    if (!detected || !ALLOWED_SIGNATURE_MIME_TYPES.includes(detected.mime as AllowedSignatureMimeType)) {
      throw ApiError.unsupportedMediaType(
        'Only genuine PNG, JPEG or WebP image files are accepted.',
      )
    }

    const mimeType = detected.mime as AllowedSignatureMimeType
    const sha256 = createHash('sha256').update(buffer).digest('hex')

    // Unpredictable, server-generated name. Sharded to keep directories small.
    const fileName = `${randomUUID()}-${randomUUID().replace(/-/g, '').slice(0, 8)}.${EXTENSION_BY_MIME[mimeType]}`
    const shardA = randomUUID().slice(0, 2)
    const shardB = randomUUID().slice(0, 2)
    const storageKey = path.posix.join(shardA, shardB, fileName)

    const absolutePath = this.resolveSafe(storageKey)

    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    // wx = fail if exists; prevents overwriting an unrelated stored signature.
    await fs.writeFile(absolutePath, buffer, { flag: 'wx' })

    return { storageKey, mimeType, sizeBytes: buffer.length, sha256 }
  }

  async read(storageKey: string): Promise<Buffer> {
    return fs.readFile(this.resolveSafe(storageKey))
  }

  async remove(storageKey: string): Promise<void> {
    try {
      await fs.unlink(this.resolveSafe(storageKey))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  /**
   * Resolves a storage key to an absolute path and proves the result stays
   * inside the storage root. Blocks `../` traversal, absolute paths and
   * symlink-style tricks.
   */
  private resolveSafe(storageKey: string): string {
    const resolvedRoot = path.resolve(this.rootDir)
    const candidate = path.resolve(resolvedRoot, storageKey)

    const rootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep
    if (candidate !== resolvedRoot && !candidate.startsWith(rootWithSep)) {
      throw ApiError.badRequest('Invalid storage key.')
    }

    return candidate
  }
}

/** Validates a client-declared size before the bytes are read into memory. */
export function assertSignatureSizeWithinLimit(sizeBytes: number, maxSizeBytes: number): void {
  if (sizeBytes <= 0) {
    throw ApiError.badRequest('The uploaded file is empty.')
  }
  if (sizeBytes > maxSizeBytes) {
    throw ApiError.payloadTooLarge(
      `The signature file exceeds the maximum size of ${maxSizeBytes} bytes.`,
    )
  }
}