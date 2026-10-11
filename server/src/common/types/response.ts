import type { Response } from 'express'
import type { PaginationMeta } from '../pagination/pagination.js'

/**
 * Standardized API response envelopes.
 *
 * Shapes follow ARCHITECTURE.md section 3.1 so the frontend can rely on a
 * single consistent contract across every endpoint.
 */

export interface ResponseMeta {
  timestamp: string
  requestId: string
}

export interface SuccessEnvelope<TData> {
  success: true
  data: TData
  meta: ResponseMeta
}

export interface PaginatedEnvelope<TItem> extends SuccessEnvelope<TItem[]> {
  meta: ResponseMeta & { pagination: PaginationMeta }
}

export interface ErrorEnvelope {
  success: false
  error: {
    code: string
    message: string
    details?: { field: string; issue: string }[]
  }
  meta: ResponseMeta
}

/** Reads the request id assigned by the request-id middleware. */
function getRequestId(res: Response): string {
  return (res.locals.requestId as string | undefined) ?? 'unknown'
}

function baseMeta(res: Response): ResponseMeta {
  return {
    timestamp: new Date().toISOString(),
    requestId: getRequestId(res),
  }
}

export function sendSuccess<TData>(res: Response, data: TData, status = 200): Response {
  const body: SuccessEnvelope<TData> = {
    success: true,
    data,
    meta: baseMeta(res),
  }
  return res.status(status).json(body)
}

export function sendCreated<TData>(res: Response, data: TData): Response {
  return sendSuccess(res, data, 201)
}

export function sendNoContent(res: Response): Response {
  return res.status(204).end()
}

export function sendPaginated<TItem>(
  res: Response,
  items: TItem[],
  pagination: PaginationMeta,
): Response {
  const body: PaginatedEnvelope<TItem> = {
    success: true,
    data: items,
    meta: { ...baseMeta(res), pagination },
  }
  return res.status(200).json(body)
}