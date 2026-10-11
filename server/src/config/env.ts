import 'dotenv/config'
import { z } from 'zod'
import path from 'node:path'
import crypto from 'node:crypto'

/**
 * Centralized, typed environment validation.
 *
 * Parsed once at import time so a misconfigured deployment fails immediately and
 * loudly instead of failing on the first request that happens to need the value.
 * Messages never echo the offending value, so secrets cannot leak into logs.
 */

/**
 * Values that must never be accepted as a real signing secret.
 *
 * Checked in EVERY environment, not only production: silently falling back to a
 * predictable secret would be a vulnerability even on localhost.
 */
const FORBIDDEN_SECRETS = [
  'change-me',
  'changeme',
  'replace-me',
  'replaceme',
  'secret',
  'secret123',
  'password',
  'test',
  'your-secret',
  'replace-with-high-entropy-64-char-secret-in-production',
  'replace-with-high-entropy-64-char-secret',
]

const MIN_SECRET_BYTES = 32

function isPlaceholderSecret(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return FORBIDDEN_SECRETS.some((bad) => normalized.includes(bad))
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  DATABASE_URL: z
    .string({ message: 'DATABASE_URL is required' })
    .min(1, 'DATABASE_URL is required')
    .refine((v) => /^postgres(ql)?:\/\//.test(v), 'DATABASE_URL must be a PostgreSQL connection string'),

  // --- Session / JWT configuration -----------------------------------------
  JWT_SECRET: z
    .string({ message: 'JWT_SECRET is required' })
    .min(1, 'JWT_SECRET is required')
    .refine(
      (v) => Buffer.byteLength(v, 'utf8') >= MIN_SECRET_BYTES,
      `JWT_SECRET must provide at least ${MIN_SECRET_BYTES} bytes of secret material`,
    )
    .refine((v) => !isPlaceholderSecret(v), 'JWT_SECRET must not be a placeholder value'),

  JWT_ISSUER: z.string().min(1).default('pspl-voucher-api'),

  JWT_AUDIENCE: z.string().min(1).default('pspl-voucher-portal'),

  JWT_TTL_SECONDS: z.coerce
    .number()
    .int('JWT_TTL_SECONDS must be an integer')
    .positive('JWT_TTL_SECONDS must be greater than zero')
    .max(60 * 60 * 24, 'JWT_TTL_SECONDS must not exceed 24 hours')
    .default(30 * 60),

  // --- CORS ----------------------------------------------------------------
  // Explicit allow-list. A wildcard is rejected outright because credentials are enabled.
  CORS_ORIGINS: z
    .string()
    .min(1, 'CORS_ORIGINS must list at least one origin')
    .default('http://localhost:5173,http://127.0.0.1:5173')
    .refine(
      (v) => !v.split(',').some((o) => o.trim() === '*'),
      'CORS_ORIGINS must not contain a wildcard: credentialed requests require explicit origins',
    ),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  /** Number of reverse-proxy hops to trust. 0 disables proxy trust entirely. */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),

  // --- Signature vault ------------------------------------------------------
  SIGNATURE_STORAGE_DIR: z.string().default('./storage/signatures'),

  MAX_SIGNATURE_FILE_SIZE_BYTES: z.coerce.number().int().positive().max(10 * 1024 * 1024).default(2 * 1024 * 1024),

  // --- Local demo provisioning (Phase 4) -----------------------------------
  DEMO_AUTH_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  DEMO_EMPLOYEE_1_PASSWORD: z.string().optional(),
  DEMO_EMPLOYEE_2_PASSWORD: z.string().optional(),
  DEMO_DIRECTOR_PASSWORD: z.string().optional(),
  DEMO_ACCOUNTS_PASSWORD: z.string().optional(),

  // --- Rate limiting --------------------------------------------------------
  RATE_LIMIT_API_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(10),
})

export type Env = z.infer<typeof envSchema>

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')

    throw new Error(
      `Invalid environment configuration. Copy server/.env.example to server/.env and fix:\n${issues}`,
    )
  }

  return parsed.data
}

const raw = loadEnv()

const nodeEnv = raw.NODE_ENV as 'development' | 'test' | 'production'
const isProduction = nodeEnv === 'production'

/**
 * Production refuses to start with an unsafe JWT secret.
 *
 * The secret is never auto-generated in production: an operator must supply it.
 */
if (isProduction) {
  if (Buffer.byteLength(raw.JWT_SECRET, 'utf8') < MIN_SECRET_BYTES) {
    throw new Error(
      `Refusing to start: JWT_SECRET must provide at least ${MIN_SECRET_BYTES} bytes in production.`,
    )
  }
  if (isPlaceholderSecret(raw.JWT_SECRET)) {
    throw new Error('Refusing to start: JWT_SECRET is a placeholder value in production.')
  }
  if (raw.DEMO_AUTH_ENABLED) {
    throw new Error('Refusing to start: DEMO_AUTH_ENABLED must be false in production.')
  }
}

const corsOrigins = Array.from(
  new Set(
    raw.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  ),
)

/**
 * Cookie name.
 *
 * Production HTTPS deployments use the `__Host-` prefix, which browsers enforce
 * must be Secure, Path=/ and carry no Domain attribute. Local HTTP development
 * cannot set Secure, so it uses an unprefixed name.
 */
const sessionCookieName = isProduction ? '__Host-pspl_session' : 'pspl_session'

/** Demo passwords must be independently supplied and reasonably strong. */
const MIN_DEMO_PASSWORD_LENGTH = 12

function collectDemoPasswordIssues(): string[] {
  const supplied: [keyof Env, string | undefined][] = [
    ['DEMO_EMPLOYEE_1_PASSWORD', raw.DEMO_EMPLOYEE_1_PASSWORD],
    ['DEMO_EMPLOYEE_2_PASSWORD', raw.DEMO_EMPLOYEE_2_PASSWORD],
    ['DEMO_DIRECTOR_PASSWORD', raw.DEMO_DIRECTOR_PASSWORD],
    ['DEMO_ACCOUNTS_PASSWORD', raw.DEMO_ACCOUNTS_PASSWORD],
  ]

  return supplied
    .filter(([, value]) => !value || value.length < MIN_DEMO_PASSWORD_LENGTH)
    .map(([key]) => `${key} must be set to at least ${MIN_DEMO_PASSWORD_LENGTH} characters`)
}

export const env: Env & {
  isProduction: boolean
  isTest: boolean
  isDevelopment: boolean
  corsOrigins: string[]
  apiPrefix: string
  signatureStoragePath: string
  sessionCookieName: string
  csrfHeaderName: string
  csrfCookieName: string
  cookieSecure: boolean
  cookieSameSite: 'lax'
  cookiePath: '/'
  demoPasswordIssues: string[]
  /** Generates a fresh random secret; used for tests and operator documentation. */
  generateEphemeralSecret: () => string
} = {
  ...raw,
  isProduction,
  isTest: nodeEnv === 'test',
  isDevelopment: nodeEnv === 'development',
  corsOrigins,
  apiPrefix: '/api/v1',
  signatureStoragePath: path.resolve(process.cwd(), raw.SIGNATURE_STORAGE_DIR),
  sessionCookieName,
  csrfHeaderName: 'x-csrf-token',
  csrfCookieName: 'pspl_csrf',
  // Secure cookies require HTTPS. Local HTTP development and tests must not set it.
  cookieSecure: isProduction,
  cookieSameSite: 'lax',
  cookiePath: '/',
  demoPasswordIssues: collectDemoPasswordIssues(),
  generateEphemeralSecret: () => crypto.randomBytes(48).toString('base64url'),
}