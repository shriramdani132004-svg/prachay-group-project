/**
 * Predictable, client-safe API error codes.
 *
 * These are contract values: clients may branch on them, so they must stay
 * stable and must never leak internal detail.
 */
export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  RATE_LIMITED: 'RATE_LIMITED',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode]

export interface FieldIssue {
  field: string
  issue: string
}

/**
 * Base class for every error that is safe to describe to a client.
 *
 * Anything thrown that is NOT an ApiError is treated as an unexpected failure:
 * it is logged server-side in full and reported as a generic 500 so internal
 * messages, SQL, file paths and connection strings never reach the client.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCodeValue
  readonly details?: FieldIssue[]
  readonly expose = true

  constructor(
    status: number,
    code: ErrorCodeValue,
    message: string,
    details?: FieldIssue[],
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    Error.captureStackTrace?.(this, ApiError)
  }

  static badRequest(message = 'The request contains invalid fields.', details?: FieldIssue[]) {
    return new ApiError(400, ErrorCode.BAD_REQUEST, message, details)
  }

  static validation(message = 'The request contains invalid fields.', details?: FieldIssue[]) {
    return new ApiError(400, ErrorCode.VALIDATION_FAILED, message, details)
  }

  static unauthorized(message = 'Authentication is required.') {
    return new ApiError(401, ErrorCode.UNAUTHORIZED, message)
  }

  static forbidden(message = 'You do not have permission to perform this action.') {
    return new ApiError(403, ErrorCode.FORBIDDEN, message)
  }

  static notFound(message = 'The requested resource was not found.') {
    return new ApiError(404, ErrorCode.NOT_FOUND, message)
  }

  static conflict(message = 'The request conflicts with the current state of the resource.') {
    return new ApiError(409, ErrorCode.CONFLICT, message)
  }

  static payloadTooLarge(message = 'The uploaded payload is too large.') {
    return new ApiError(413, ErrorCode.PAYLOAD_TOO_LARGE, message)
  }

  static unsupportedMediaType(message = 'The supplied media type is not supported.') {
    return new ApiError(415, ErrorCode.UNSUPPORTED_MEDIA_TYPE, message)
  }

  static unprocessable(message = 'The request was understood but could not be processed.') {
    return new ApiError(422, ErrorCode.UNPROCESSABLE_ENTITY, message)
  }

  static databaseUnavailable(message = 'A required dependency is currently unavailable.') {
    return new ApiError(503, ErrorCode.DATABASE_UNAVAILABLE, message)
  }

  static internal(message = 'An unexpected error occurred.') {
    return new ApiError(500, ErrorCode.INTERNAL_ERROR, message)
  }
}