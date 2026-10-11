import { createApp } from './app.js'
import { env } from './config/env.js'
import { logger } from './utils/logger.js'
import { checkDatabaseConnection, disconnectDatabase } from './lib/prisma.js'

/**
 * Network entry point.
 *
 * Keeps all listening behaviour out of `app.ts` so the app can be imported by
 * tests without binding a port.
 */

const app = createApp()

const server = app.listen(env.PORT, async () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, apiPrefix: env.apiPrefix },
    'PSPL voucher API listening',
  )

  try {
    await checkDatabaseConnection()
    logger.info('Database connection verified at startup')
  } catch (error) {
    // Logged without any connection detail; the health endpoints report the
    // true state and the process stays up so recovery does not require a restart.
    logger.error({ err: error }, 'Database unreachable at startup')
  }
})

/** Closes the HTTP server, then releases the database pool. */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown initiated')

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out; forcing exit')
    process.exit(1)
  }, 10_000)
  forceExit.unref()

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
    await disconnectDatabase()
    logger.info('Shutdown complete')
    process.exit(0)
  } catch (error) {
    logger.error({ err: error }, 'Error during shutdown')
    process.exit(1)
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection')
})

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception; exiting')
  void shutdown('uncaughtException')
})