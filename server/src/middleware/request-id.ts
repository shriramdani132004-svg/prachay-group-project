import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'

/**
 * Assigns a request id used for log correlation and echoed in every response
 * envelope. Reuses an inbound `x-request-id` when present so a trace can span
 * services, otherwise generates a fresh UUID.
 */
export const requestId: RequestHandler = (req, res, next) => {
  const inbound = req.header('x-request-id')

  const id =
    typeof inbound === 'string' && /^[\w-]{1,128}$/.test(inbound) ? inbound : randomUUID()

  res.locals.requestId = id
  res.setHeader('x-request-id', id)

  next()
}