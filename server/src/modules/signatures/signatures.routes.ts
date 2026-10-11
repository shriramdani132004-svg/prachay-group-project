import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { ApiError } from '../../common/errors/api-error.js'
import { validate } from '../../middleware/validate-request.js'
import { requireAuth } from '../../middleware/require-auth.js'
import { requireCsrf } from '../../middleware/csrf.js'
import { uuidSchema } from '../../common/validation/schemas.js'
import { canAccessSignature } from '../../middleware/auth-contract.js'
import { prisma } from '../../lib/prisma.js'
import { LocalSignatureStorage } from './signature-storage.js'
import { toSignatureMetadata, upsertVoucherSignature } from './signature.service.js'
import { assertCanEditVoucher } from '../vouchers/voucher-policy.service.js'
import { loadDecidableVoucher } from '../vouchers/voucher-workflow.service.js'
import { env } from '../../config/env.js'

export const signaturesRouter = Router()

const idParamSchema = z.object({ id: uuidSchema })

/** Multipart body field holding the voucher id (text field, not a file). */
const uploadBodySchema = z.object({ voucherId: uuidSchema }).strict()

/**
 * GET /api/v1/signatures/:id
 *
 * Signature bytes are private. Access requires a valid session AND passes the
 * ownership/role policy, and the ownership check is applied IN THE QUERY so an
 * Employee can never even load another employee's signature record.
 *
 * The internal `storageKey` is never returned - the caller receives the stored
 * bytes only after authorization succeeds.
 */
signaturesRouter.get(
  '/:id',
  requireAuth,
  validate({ params: idParamSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as z.infer<typeof idParamSchema>
      const user = req.user!

      const signature = await prisma.signature.findUnique({
        where: { id },
        select: {
          id: true,
          type: true,
          mimeType: true,
          sizeBytes: true,
          sha256: true,
          createdAt: true,
          // Selected for internal use only. It is never serialized to the
          // client: the response streams the bytes, not the storage location.
          storageKey: true,
          voucher: { select: { id: true, createdById: true } },
        },
      })

      // Missing and unauthorized both yield 404: the existence of the record
      // is not disclosed to an unauthorized caller.
      if (!signature) {
        throw ApiError.notFound('The requested signature does not exist.')
      }

      const authorized = canAccessSignature({
        requesterRole: user.role,
        requesterId: user.id,
        voucherOwnerId: signature.voucher.createdById,
      })

      if (!authorized) {
        throw ApiError.notFound('The requested signature does not exist.')
      }

      const storage = new LocalSignatureStorage(
        env.signatureStoragePath,
        env.MAX_SIGNATURE_FILE_SIZE_BYTES,
      )

      const bytes = await storage.read(signature.storageKey)

      res.setHeader('Content-Type', signature.mimeType)
      res.setHeader('Content-Length', String(bytes.length))
      // Private image bytes: never cached by a shared proxy, never sniffed
      // into a different content type by the browser.
      res.setHeader('Cache-Control', 'private, no-store')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Disposition', 'inline')
      res.status(200).end(bytes)
    } catch (error) {
      next(error)
    }
  },
)

// ------------------------------------------------------------------------------
// Upload
// ------------------------------------------------------------------------------

/**
 * Memory storage only: bytes are validated by content (magic bytes) inside
 * `LocalSignatureStorage.store` and written under a server-generated name.
 * Multer never sees a filesystem path from the client.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_SIGNATURE_FILE_SIZE_BYTES,
    files: 1,
    fields: 8,
  },
})

/** Maps multer's own errors onto the API envelope. */
function uploadSingle(field: string) {
  const handler = upload.single(field)
  return (req: Parameters<typeof handler>[0], res: Parameters<typeof handler>[1], next: Parameters<typeof handler>[2]) => {
    handler(req, res, (error: unknown) => {
      if (!error) return next()
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return next(
            ApiError.payloadTooLarge(
              `The signature file exceeds the maximum size of ${env.MAX_SIGNATURE_FILE_SIZE_BYTES} bytes.`,
            ),
          )
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(ApiError.validation('Exactly one file field named "file" is expected.'))
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
          return next(ApiError.validation('Only one signature file may be uploaded at a time.'))
        }
        return next(ApiError.validation(`The upload could not be processed (${error.code}).`))
      }
      next(error)
    })
  }
}

/**
 * POST /api/v1/signatures/upload  (multipart/form-data)
 *
 * Fields:
 * - `file`: the image bytes (PNG, JPEG or WebP; content is sniffed, never
 *   trusted from the client-declared type). Limited by
 *   MAX_SIGNATURE_FILE_SIZE_BYTES before it is buffered.
 * - `voucherId`: the voucher the signature belongs to.
 *
 * Authorization and signature type are derived from the AUTHENTICATED role:
 * - EMPLOYEE: own voucher, still DRAFT (signing happens before submission).
 * - DIRECTOR: any voucher in PENDING_APPROVAL (signing happens at decision
 *   time, before the approve/reject call).
 * - ACCOUNTS: forbidden (read-only role, never signs).
 *
 * Uploading the same type again REPLACES the previous signature; other roles'
 * signatures are never touched.
 */
signaturesRouter.post(
  '/upload',
  requireAuth,
  requireCsrf,
  uploadSingle('file'),
  validate({ body: uploadBodySchema }),
  async (req, res, next) => {
    try {
      const user = req.user!
      const { voucherId } = req.body as z.infer<typeof uploadBodySchema>

      if (user.role === 'ACCOUNTS') {
        throw ApiError.forbidden('Accounts cannot upload signatures.')
      }

      if (user.role === 'EMPLOYEE') {
        // Own voucher + still DRAFT: same policy as editing the draft.
        // A submitted voucher's employee signature is frozen with the
        // submission; a decision's director signature is frozen with the
        // decision (statuses are terminal afterwards).
        await assertCanEditVoucher(user, voucherId)
      } else {
        // DIRECTOR: only while the voucher actually awaits a decision.
        // 404 for missing/unknown ids, 409 for decided/draft vouchers.
        await loadDecidableVoucher(voucherId)
      }

      const file = req.file
      if (!file || file.size === 0) {
        throw ApiError.validation('A signature file is required.', [
          { field: 'file', issue: 'Required' },
        ])
      }

      const record = await upsertVoucherSignature({
        voucherId,
        type: user.role === 'EMPLOYEE' ? 'EMPLOYEE' : 'DIRECTOR',
        uploadedById: user.id,
        buffer: file.buffer,
      })

      res.status(201).json({
        success: true,
        data: toSignatureMetadata(record),
        meta: { timestamp: new Date().toISOString(), requestId: res.locals.requestId },
      })
    } catch (error) {
      next(error)
    }
  },
)
