# PSPL Expense Voucher Management System — Backend API

Phase 3 backend: Express 5 + Prisma 7 + PostgreSQL.

This workspace provides the **API foundation and database layer only**. Authentication,
voucher CRUD, Director decisions, Accounts workflows and document export are deliberately
*not* implemented here — they belong to Phases 4–7. Every protected route **fails closed**.

---

## 1. Technology stack

| Component | Version | Purpose |
| :--- | :--- | :--- |
| Node.js | 24.x (requires `>=20.19`) | Runtime |
| TypeScript | 5.9 | Strict type checking |
| Express | 5.3 | HTTP framework |
| Prisma ORM | 7.10 | Schema, migrations, typed client |
| `@prisma/adapter-pg` | 7.10 | PostgreSQL driver adapter (required by Prisma 7) |
| `pg` | 8.x | PostgreSQL driver |
| PostgreSQL | 18 (Docker image used for local dev) | Database |
| Zod | 4.x | Request/environment validation |
| Pino + pino-http | 10/11 | Structured logging |
| Helmet | 8.x | Security headers |
| CORS | 2.8 | Origin restriction |
| Multer + file-type | 2.x / 21.x | Bounded multipart parsing + magic-byte detection |
| Vitest + Supertest | 3.x / 7.x | Unit and API integration tests |
| tsx | 4.x | TypeScript execution for dev/seed |
| oxlint | 1.81 | Linting |

---

## 2. Prerequisites

- Node.js `>= 20.19`
- npm 10+
- A reachable PostgreSQL 14+ instance

---

## 3. Environment setup

```bash
cd server
npm install
cp .env.example .env     # Windows: Copy-Item .env.example .env
```

Then edit `server/.env`. Values are validated by Zod at startup; a missing or malformed
variable aborts the process immediately with a message that never echoes the value.

| Variable | Required | Default | Notes |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | No | `development` | `development` \| `test` \| `production` |
| `PORT` | No | `3000` | API port (frontend uses 5173) |
| `DATABASE_URL` | **Yes** | – | PostgreSQL connection string |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Comma-separated allow-list |
| `LOG_LEVEL` | No | `info` | Pino level |
| `SIGNATURE_STORAGE_DIR` | No | `./storage/signatures` | Private vault, resolved to an absolute path |
| `MAX_SIGNATURE_FILE_SIZE_BYTES` | No | `2097152` | 2 MB ceiling |

`JWT_SECRET`, `JWT_EXPIRES_IN` and cookie settings are **not read in Phase 3**; they are
introduced in Phase 4.

---

## 4. PostgreSQL setup (local development)

The Phase 3 development database runs in an isolated Docker container bound to
`127.0.0.1` so it never collides with, or disturbs, any other local PostgreSQL instance:

```bash
docker run -d --name pspl-postgres-dev \
  -e POSTGRES_USER=pspl \
  -e POSTGRES_PASSWORD=pspl_dev_only \
  -e POSTGRES_DB=pspl_voucher_dev \
  -p 127.0.0.1:5433:5432 postgres:18-alpine
```

These are **local development credentials only** — never reuse them anywhere else.

---

## 5. Prisma commands

```bash
npm run prisma:format         # Format the schema
npm run prisma:validate       # Validate the schema
npm run prisma:generate       # Generate the typed client into src/generated/prisma
npm run prisma:migrate:dev    # Create + apply a development migration
npm run prisma:migrate:deploy # Apply committed migrations (CI / production)
npm run prisma:migrate:status # Show migration status
npm run prisma:seed           # Idempotent development seed
npm run prisma:studio         # Prisma Studio
```

Configuration lives in `prisma.config.ts` (Prisma 7 convention). Migrations are committed
under `prisma/migrations/` and must stay in Git.

---

## 6. Migrations

`prisma/migrations/20261010135612_init_schema/migration.sql` creates:

- 4 enums: `UserRole`, `VoucherStatus`, `SignatureType`, `VoucherEventType`
- 7 tables: `departments`, `expense_categories`, `users`, `vouchers`, `signatures`,
  `voucher_events`, plus the `_prisma_migrations` bookkeeping table
- Foreign keys, unique constraints and 13 indexes
- The `voucher_number_seq` sequence
- 4 CHECK constraints (see below)

### Database-level guarantees Prisma cannot express

These are appended to the migration SQL and enforced by PostgreSQL itself:

| Constraint | Rule |
| :--- | :--- |
| `chk_vouchers_amount_positive` | `amount > 0` |
| `chk_vouchers_rejected_has_reason` | a `REJECTED` voucher must carry a non-empty reason |
| `chk_vouchers_approved_has_reviewer` | an `APPROVED` voucher must record reviewer + timestamp |
| `chk_signatures_size_positive` | `0 < sizeBytes <= 2097152` |
| `uq_users_email_lower` | unique index on `lower(email)` — case-insensitive uniqueness |
| `voucher_number_seq` | atomic, collision-safe voucher numbering |

---

## 7. Voucher numbering

Format: **`VCH-<year>-<6-digit sequence>`**, e.g. `VCH-2026-000001`.
(ARCHITECTURE.md §6.1 permits this sequence-backed variant.)

Numbers come from `nextval('voucher_number_seq')`, which is atomic. `MAX(number) + 1` is
**never** used — that pattern races under concurrency. Gaps after rolled-back transactions
are acceptable; duplicates are not, and are additionally blocked by a `UNIQUE` constraint.
The sequence is not reset by seeding.

---

## 8. Voucher lifecycle (policy only)

```
DRAFT ──submit──▶ SUBMITTED ──automatic promotion──▶ PENDING_APPROVAL
                                                          │
                                        ┌─────────────────┴─────────────────┐
                                     approve                             reject
                                        ▼                                   ▼
                                    APPROVED                           REJECTED
```

**A completed submit leaves the voucher in `PENDING_APPROVAL`.** `SUBMITTED` is recorded as
a transient transition inside the same transaction, so the audit trail shows both
transitions while the row is never stranded in an intermediate state. Enforced by
`src/modules/vouchers/voucher-policy.ts` and unit tested.

The corresponding HTTP endpoints are **not mounted** in Phase 3.

---

## 9. Running the API

```bash
npm run dev     # tsx watch, development
npm run build   # prisma generate + tsc build to dist/
npm start       # node dist/server.js
```

Health check:

```bash
curl http://127.0.0.1:3000/api/v1/health
```

`app.ts` exports `createApp()` and binds **no port**, so tests can mount it with Supertest.
`server.ts` owns the listening logic, graceful shutdown (SIGINT/SIGTERM), and disconnect.

---

## 10. API endpoints

Base path: `/api/v1`

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | No | Service metadata |
| `GET` | `/api/v1/health` | No | Health **including a real database round-trip** (200 / 503) |
| `GET` | `/api/v1/health/live` | No | Liveness; never touches the database (200) |
| `GET` | `/api/v1/health/ready` | No | Readiness; 503 when the database is unreachable |
| `GET` | `/api/v1/departments` | No | Active departments from PostgreSQL (paginated) |
| `GET` | `/api/v1/expense-categories` | No | Active categories from PostgreSQL (paginated) |
| `*` | `/api/v1/vouchers/**` | **401** | Fails closed — Phase 5 |
| `*` | `/api/v1/approvals/**` | **401** | Fails closed — Phase 6 |
| `*` | `/api/v1/analytics/**` | **401** | Fails closed — Phase 7 |
| `*` | `/api/v1/signatures/**` | **401** | Fails closed — Phase 4+ |

`/health` returns **200 only when a real `SELECT 1` succeeds**; it never reports a fake
healthy database state. `/health/live` deliberately does not query PostgreSQL so a transient
outage cannot cause an orchestrator to kill a healthy process.

### Response envelopes

Success:

```json
{
  "success": true,
  "data": {},
  "meta": { "timestamp": "2026-10-10T14:13:09.025Z", "requestId": "..." }
}
```

Listings add pagination metadata:

```json
{ "success": true, "data": [], "meta": { "timestamp": "...", "requestId": "...",
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 6, "totalPages": 1,
                  "hasNextPage": false, "hasPreviousPage": false } } }
```

Error:

```json
{
  "success": false,
  "error": { "code": "VALIDATION_FAILED", "message": "Invalid pagination parameters: page.",
             "details": [{ "field": "page", "issue": "page must be greater than or equal to 1" }] },
  "meta": { "timestamp": "...", "requestId": "..." }
}
```

Error codes: `VALIDATION_FAILED`, `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`,
`CONFLICT`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `UNPROCESSABLE_ENTITY`,
`INVALID_STATE_TRANSITION`, `NOT_IMPLEMENTED`, `RATE_LIMITED`, `DATABASE_UNAVAILABLE`,
`INTERNAL_ERROR`.

Stack traces, SQL, filesystem paths and connection strings are never returned to clients.

### Pagination

`page` (1-based, default 1), `pageSize` (default 20, **max 100**), `sortBy` (allow-listed
only), `sortOrder` (`asc`/`desc`). Sort keys are validated against an explicit allow-list
and mapped to known columns — client input is never interpolated into SQL.

---

## 11. Signature storage policy

Files are stored **outside** PostgreSQL in `SIGNATURE_STORAGE_DIR` and are **never** served
with `express.static`. Only metadata (type, size, SHA-256, verified MIME) lives in the
`signatures` table.

`LocalSignatureStorage` enforces:

- **Content-based validation** — magic-byte detection via `file-type`; the client filename
  and `Content-Type` are ignored. PNG/JPEG/WebP only, so SVG/HTML/PDF/EXE are rejected.
- **Size ceiling** — configurable, 2 MB by default (enforced both before and after read).
- **Unpredictable names** — two `randomUUID()` values per file, sharded two levels deep.
- **Path traversal defence** — every key is resolved and re-validated to stay inside the root.
- **No overwrite** — files are created with the `wx` flag.
- **Metadata, not paths**, are returned to callers.

Access policy (`canAccessSignature`) **fails closed**: employees may reach only their own
vouchers' signatures, Directors and Accounts have organization-wide access, and anyone
without a verified identity is denied. No signature route is mounted in Phase 3.

---

## 12. Testing

```bash
npm test                 # unit only (no database required)
npm run test:integration # API + real PostgreSQL
npm run test:all         # everything
```

Current status: **113 tests passing** (80 unit + 33 integration), 0 skipped.

Integration tests probe database availability with a **top-level await before collection** —
a `beforeAll` probe would be too late, because `it.skipIf()` is evaluated during collection
and would silently skip every database test against a perfectly healthy database. If
PostgreSQL is genuinely unreachable the suite prints an explicit `[BLOCKED]` notice rather
than reporting a pass.

---

## 13. Security limitations (honest status)

- **No authentication.** Every protected route returns 401. Phase 4 implements JWT sessions.
- `users.passwordHash` exists only as an account-provisioning accommodation and is `NULL` for
  all seeded fixtures. It is never selected into an API response and is redacted from logs.
- Seeded identities are database fixtures, not usable accounts.
- No rate limiting yet (the `RATE_LIMITED` code exists but is not enforced).
- `updatedAt` has no database default — Prisma's `@updatedAt` is applied client-side, so
  raw SQL writers must supply it explicitly.
- Prisma's CLI pulls in transitive advisories (`mysql2`, `deepmerge-ts`). `mysql2` is unused
  (this project uses `pg` via `@prisma/adapter-pg`), so the practical exposure is CLI-only.

---

## 14. Project layout

```
server/
├── prisma.config.ts        # Prisma 7 configuration
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── app.ts              # Express factory (no port binding)
│   ├── server.ts           # Listener, shutdown, signal handling
│   ├── config/env.ts       # Zod-validated environment
│   ├── lib/prisma.ts       # Single Prisma client + connectivity probe
│   ├── common/
│   │   ├── errors/api-error.ts
│   │   ├── pagination/pagination.ts
│   │   ├── types/response.ts
│   │   └── validation/schemas.ts
│   ├── middleware/         # request-id, validate, error-handler, not-found, auth-contract
│   ├── modules/
│   │   ├── health/
│   │   ├── departments/
│   │   ├── expense-categories/
│   │   ├── vouchers/       # numbering + lifecycle policy (no routes yet)
│   │   └── signatures/     # private storage (no routes yet)
│   ├── routes/index.ts
│   └── utils/logger.ts
├── tests/{unit,integration}/
└── storage/signatures/     # private vault, git-ignored
```