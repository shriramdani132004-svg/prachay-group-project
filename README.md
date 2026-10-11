# PSPL Expense Voucher Management System

> Expense voucher lifecycle management for **Prachay Securities Private Limited
> (PSPL)** — employees create and submit vouchers, a Director approves or
> rejects them with a signature, and Accounts audits an organization-wide
> read-only register with analytics and printable receipts.

[![Backend Tests](https://img.shields.io/badge/backend%20tests-355%20passed-brightgreen)](#20-running-tests)
[![Playwright](https://img.shields.io/badge/e2e-33%2F33-brightgreen)](#20-running-tests)
[![Typecheck](https://img.shields.io/badge/tsc-clean-brightgreen)](#22-code-quality)
[![Audit](https://img.shields.io/badge/npm%20audit-0%20vulnerabilities-brightgreen)](#22-code-quality)
[![Deployment](https://img.shields.io/badge/deployment-BLOCKED-orange)](#25-deployment-status)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Key Features](#2-key-features)
3. [Technology Stack](#3-technology-stack)
4. [Architecture Overview](#4-architecture-overview)
5. [Repository Structure](#5-repository-structure)
6. [Prerequisites](#6-prerequisites)
7. [Quick Start](#7-quick-start)
8. [Database Setup](#8-database-setup)
9. [Backend Setup](#9-backend-setup)
10. [Frontend Setup](#10-frontend-setup)
11. [Environment Variables](#11-environment-variables)
12. [Database Schema](#12-database-schema)
13. [Voucher State Machine](#13-voucher-state-machine)
14. [API Overview](#14-api-overview)
15. [Authentication & Sessions](#15-authentication--sessions)
16. [Role-Based Access Control](#16-role-based-access-control)
17. [Signature Vault](#17-signature-vault)
18. [Analytics](#18-analytics)
19. [Print & PDF Export](#19-print--pdf-export)
20. [Running Tests](#20-running-tests)
21. [Test Coverage Summary](#21-test-coverage-summary)
22. [Code Quality](#22-code-quality)
23. [Demo Accounts](#23-demo-accounts)
24. [Demo Guide](#24-demo-guide)
25. [Deployment Status](#25-deployment-status)
26. [Production Build & Start](#26-production-build--start)
27. [Security Summary](#27-security-summary)
28. [Troubleshooting](#28-troubleshooting)
29. [Known Limitations](#29-known-limitations)
30. [Documentation Index](#30-documentation-index)
31. [Requirements Traceability](#31-requirements-traceability)
32. [Project Status (Phase History)](#32-project-status-phase-history)
33. [License](#33-license)

---

## 1. Overview

PSPL employees incur business expenses and need a governed path from draft to
paid record. This system implements that path end to end:

- **Employee** creates a voucher (date, department, category, amount, title),
  attaches a signature, and submits it. Drafts are fully editable; submitted
  vouchers are locked.
- **Director** reviews an organization-wide pending queue, inspects the full
  voucher, then **approves** (with their signature) or **rejects** (with a
  mandatory written reason).
- **Accounts** sees a strictly read-only organization-wide register with
  search, filters, analytics (status distribution, expense trends, category
  breakdown, recent activity), signature inspection, and printable receipts.

Every mutation is authorized **server-side**. The browser never decides
permissions; it only reflects them.

## 2. Key Features

| Role | Capabilities |
| :--- | :--- |
| **Employee** | Dashboard KPIs; create/edit/delete drafts; draw or upload signature; submit for approval; view own vouchers only; see rejection reasons and full audit timeline |
| **Director** | Dashboard KPIs; organization-wide pending queue; search/filter/sort/paginate; read-only voucher inspection; approve with drawn/uploaded signature; reject with mandatory ≥10-character reason |
| **Accounts** | Dashboard KPIs; organization-wide read-only register; search/filter/sort; inspect both signatures; analytics charts; print/save PDF receipts |
| **System** | Unique voucher numbers (`VCH-YYYY-NNNNNN`); append-only audit trail; private signature vault; JWT session cookies with revocation; CSRF protection; rate limiting; structured logging with credential redaction |

## 3. Technology Stack

### Frontend (`client/`)

- **React 19** + **TypeScript** (strict), **Vite 8**
- **Tailwind CSS v4** (CSS-first configuration — no `tailwind.config.ts`)
- **React Router 7**, **TanStack Query 5**, **Zustand 5**
- **React Hook Form** + **Zod** (forms), **Recharts** (analytics)
- **Framer Motion**, **Lucide** icons
- **Playwright** (bundled Chromium) for end-to-end tests

### Backend (`server/`)

- **Node.js 20.19+** (developed on Node 24) with **Express 5** + **TypeScript 5.9**
- **Prisma 7** + **PostgreSQL** (driver adapter `@prisma/adapter-pg`)
- **Zod v4** (environment + request validation)
- **jose** (HS256 JWT) + **bcryptjs** (cost 12) + **cookie-parser**
- **Helmet**, strict **CORS** allowlist, **express-rate-limit**
- **Multer** + **file-type** (magic-byte verified signature uploads)
- **Pino** / **pino-http** (structured logs, credential redaction)
- **Vitest 5** + **Supertest** (unit + integration against real PostgreSQL)

## 4. Architecture Overview

```
Browser (React SPA, port 5173)
   │  fetch /api/v1/*  (HttpOnly session cookie + x-csrf-token)
   ▼
Vite dev proxy ──► Express API (port 3000)
                     │  Zod validation → RBAC middleware → service layer
                     ▼
              Prisma 7 client ──► PostgreSQL (127.0.0.1:5433 dev)
                     │
                     └──► Private signature vault (local filesystem)
```

- The **server is the security boundary**: ownership, role and workflow-state
  checks run before any data is read or written.
- Monetary values are `NUMERIC(12,2)` decimals — never floating point.
- Signature image **bytes** live outside PostgreSQL; only metadata (MIME,
  size, SHA-256, opaque storage key) is stored in the database.
- Full detail: [`ARCHITECTURE.md`](ARCHITECTURE.md).

## 5. Repository Structure

```
prachay-group-project/
├── client/                      # React SPA
│   ├── src/
│   │   ├── app/                 # Router, providers
│   │   ├── components/          # common, forms, documents, feedback,
│   │   │                        # layout, overlays, signatures, data-display
│   │   ├── features/            # auth, employee, director, accounts
│   │   ├── hooks/               # useAuth, useVouchers (TanStack Query)
│   │   └── lib/                 # api client, utils, cn
│   ├── tests/e2e/               # Playwright specs + API mocks
│   └── playwright.config.ts     # project "chromium"
├── server/                      # Express API
│   ├── prisma/                  # schema, migrations, seed
│   ├── src/
│   │   ├── config/              # env.ts (Zod-validated env)
│   │   ├── common/              # errors, middleware, validation
│   │   ├── modules/             # auth, vouchers, signatures,
│   │   │                        # departments, expense-categories,
│   │   │                        # analytics (service), health
│   │   └── generated/prisma/    # generated client (gitignored)
│   ├── storage/signatures/      # private vault (gitignored)
│   └── tests/                   # unit + integration (Vitest)
├── docs/                        # API, deployment, security, demo, screenshots
├── docker-compose.dev.yml       # local PostgreSQL on 127.0.0.1:5433
├── ARCHITECTURE.md
├── PROJECT_PLAN.md
├── REQUIREMENTS_TRACEABILITY.md
├── PHASE_TRACKER.md
└── README.md                    # this file
```

## 6. Prerequisites

| Tool | Version | Notes |
| :--- | :--- | :--- |
| Node.js | **≥ 20.19** (tested 24.x) | `node --version` |
| npm | ≥ 9 (tested 11.x) | ships with Node |
| Docker | any recent | only for the local dev database (or any PostgreSQL 14+ on port **5433**) |
| Chromium | downloaded by Playwright | `npx playwright install chromium` |

> **Port contract**: the dev database is always `127.0.0.1:5433` (never 5432 —
> that port is reserved for any other local PostgreSQL). The API is `3000`;
> the frontend dev server is `5173`.

## 7. Quick Start

```bash
git clone https://github.com/shriramdani132004-svg/prachay-group-project.git
cd prachay-group-project

# 1. Development database (PostgreSQL on 127.0.0.1:5433)
docker compose -f docker-compose.dev.yml up -d

# 2. Backend
cd server
npm install
copy .env.example .env        # PowerShell (use cp on macOS/Linux)
# edit server/.env: set a strong JWT_SECRET (≥ 32 bytes, not a placeholder)
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:seed
npm run dev                   # http://127.0.0.1:3000

# 3. Frontend (new terminal)
cd client
npm install
npx playwright install chromium
npm run dev                   # http://127.0.0.1:5173
```

Open <http://127.0.0.1:5173> and sign in with a provisioned demo account
(see [§23](#23-demo-accounts)).

> On Windows PowerShell, quote paths containing spaces:
> `Set-Location -LiteralPath "C:\Users\you\Desktop\prachay group project\server"`.

## 8. Database Setup

The one-command dev database:

```bash
docker compose -f docker-compose.dev.yml up -d      # start
docker compose -f docker-compose.dev.yml ps         # healthy?
docker compose -f docker-compose.dev.yml down -v    # stop and wipe data
```

It runs `postgres:16-alpine` publishing **127.0.0.1:5433→5432**, database
`pspl_voucher_dev`, user `pspl` (override the dev-only password with
`POSTGRES_PASSWORD=...` — never reuse it anywhere else).

Then, from `server/`:

```bash
npm run prisma:migrate:status      # expect: 2 migrations, up to date
npm run prisma:migrate:deploy      # apply migrations
npm run prisma:seed                # demo departments, categories, users, vouchers
```

The seed is **idempotent**, refuses to run when `NODE_ENV=production`, and
creates ten vouchers spanning every workflow status plus synthetic signature
files in the private vault so dashboards and the register have realistic data.

## 9. Backend Setup

```bash
cd server
npm install
copy .env.example .env
```

Minimum `.env` (see [§11](#11-environment-variables) for the full list):

```ini
DATABASE_URL="postgresql://pspl:pspl_dev_only@127.0.0.1:5433/pspl_voucher_dev"
JWT_SECRET="<generate: openssl rand -base64 48>"
```

```bash
npm run prisma:generate        # required after install (client is generated)
npm run dev                    # tsx watch → http://127.0.0.1:3000
curl http://127.0.0.1:3000/api/v1/health
```

## 10. Frontend Setup

```bash
cd client
npm install
npx playwright install chromium   # once, for the E2E suite
npm run dev                       # → http://127.0.0.1:5173
```

The Vite dev server proxies `/api/*` to `http://127.0.0.1:3000`, so no CORS
configuration is needed in development. With the API stopped, unmocked
requests surface as console errors (the E2E suite intercepts them).

## 11. Environment Variables

Validated once at startup by [`server/src/config/env.ts`](server/src/config/env.ts)
(Zod). A misconfigured server **fails to start** with a precise message that
never echoes secret values.

| Variable | Required | Default | Notes |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | no | `development` | `development` \| `test` \| `production` |
| `PORT` | no | `3000` | API port |
| `DATABASE_URL` | **yes** | — | PostgreSQL URL; must target port **5433** in dev |
| `JWT_SECRET` | **yes** | — | ≥ 32 bytes; placeholder values rejected in every env |
| `JWT_ISSUER` | no | `pspl-voucher-api` | JWT `iss` claim |
| `JWT_AUDIENCE` | no | `pspl-voucher-portal` | JWT `aud` claim |
| `JWT_TTL_SECONDS` | no | `1800` (30 min) | max 86400 |
| `CORS_ORIGINS` | no | `http://localhost:5173,http://127.0.0.1:5173` | comma-separated; `*` rejected |
| `LOG_LEVEL` | no | `info` | pino level |
| `TRUST_PROXY_HOPS` | no | `0` | reverse-proxy hops to trust |
| `SIGNATURE_STORAGE_DIR` | no | `./storage/signatures` | private vault path |
| `MAX_SIGNATURE_FILE_SIZE_BYTES` | no | `2097152` (2 MiB) | upload cap |
| `DEMO_AUTH_ENABLED` | no | `false` | must be `false` in production |
| `DEMO_EMPLOYEE_1_PASSWORD` | for demo | — | ≥ 12 chars, used only by `auth:provision-demo` |
| `DEMO_EMPLOYEE_2_PASSWORD` | for demo | — | " |
| `DEMO_DIRECTOR_PASSWORD` | for demo | — | " |
| `DEMO_ACCOUNTS_PASSWORD` | for demo | — | " |
| `RATE_LIMIT_API_MAX` | no | `300` | requests / window, per IP |
| `RATE_LIMIT_LOGIN_MAX` | no | `10` | login attempts / window, per IP |

Production additionally **refuses to start** with `DEMO_AUTH_ENABLED=true` or
a short/placeholder `JWT_SECRET`.

## 12. Database Schema

Eight tables (Prisma models → migrations in `server/prisma/migrations/`):

| Table | Purpose | Key constraints |
| :--- | :--- | :--- |
| `departments` | org reference data | unique `code`, `name` |
| `expense_categories` | expense types | unique `code`, `name` |
| `users` | identities + roles | unique `email`; role enum `EMPLOYEE\|DIRECTOR\|ACCOUNTS`; nullable `passwordHash` (NULL = not provisioned) |
| `auth_sessions` | revocable sessions | `csrfToken`, `expiresAt`, `revokedAt`; JWT `sid` points here |
| `vouchers` | the core record | unique `voucherNumber` (`VCH-YYYY-NNNNNN` via DB sequence); `amount NUMERIC(12,2)` with CHECK `> 0`; status enum; snapshots of employee id/name; `rejectionReason`; six indexes for list/analytics queries |
| `signatures` | vault metadata | unique `(voucherId, type)` — one employee + one director signature per voucher; `storageKey` opaque; `mimeType` from magic bytes; `sha256`; never stores bytes |
| `voucher_events` | append-only timeline | `CREATED\|UPDATED\|SUBMITTED\|PENDING_APPROVAL\|APPROVED\|REJECTED`; optional actor; JSON metadata |

Design rules enforced everywhere:

- **No floating-point money** — `Decimal`/`NUMERIC(12,2)` end to end, serialized
  with `toFixed(2)`/`decimalToString`.
- **Immutable history** — employee snapshots keep old vouchers readable after
  renames; `voucher_events` is append-only.
- **Soft reference integrity** — `Restrict` on department/category/user so
  historical vouchers can't be orphaned by careless deletes.

## 13. Voucher State Machine

```
                 ┌──────────────────────────────────────┐
                 │                                      ▼
  (create) ──► DRAFT ──submit──► PENDING_APPROVAL ──approve──► APPROVED
                 │                     │
                 │                     └──reject (reason ≥ 10 chars)──► REJECTED
                 └──delete (owner, DRAFT only)──► (gone)
```

- **DRAFT**: owner-only; full edit/delete allowed.
- **PENDING_APPROVAL**: locked for the employee; only the Director may decide.
- **APPROVED / REJECTED**: terminal. Any edit attempt returns `409`.
- Transitions are conditional database updates — two simultaneous Director
  decisions resolve to exactly **one** winner; the loser gets `409`.
- Rejection requires a written reason (≥ 10 characters, validated **before**
  the state check).
- Approve requires the Director's signature to already exist on the voucher
  (else `422`).

## 14. API Overview

Base path: **`/api/v1`**. Full reference with request/response shapes:
[`docs/API.md`](docs/API.md).

| Method & path | Auth | Purpose |
| :--- | :---: | :--- |
| `GET /health`, `/health/live`, `/health/ready` | public | liveness/readiness |
| `POST /auth/login` | public, rate-limited | set HttpOnly session cookie + CSRF token |
| `GET /auth/me` | session | rehydrate user + CSRF token |
| `POST /auth/logout`, `/auth/logout-all` | session + CSRF | revoke session(s) |
| `GET /departments`, `GET /expense-categories` | session | reference data |
| `GET /vouchers` | session, scoped | list (employee: own only; director/accounts: org-wide) with search/filter/sort/pagination |
| `POST /vouchers` | employee | create draft |
| `GET /vouchers/:id` | session, ownership/role | detail + signatures + events |
| `PATCH /vouchers/:id` | employee, owner, DRAFT | edit draft fields |
| `DELETE /vouchers/:id` | employee, owner, DRAFT | delete draft |
| `POST /vouchers/:id/submit` | employee, owner, DRAFT | → PENDING_APPROVAL |
| `POST /vouchers/:id/approve` | **director** | → APPROVED (signature required) |
| `POST /vouchers/:id/reject` | **director** | → REJECTED (reason ≥ 10 chars) |
| `GET /vouchers/:id/events` | session, ownership/role | audit timeline |
| `GET /vouchers/dashboard`, `/director/dashboard`, `/accounts/dashboard` | session, role-scoped | KPI aggregates |
| `GET /vouchers/analytics/status`, `/trends`, `/categories`, `GET /vouchers/activity` | session, role-scoped | charts |
| `POST /signatures/upload` | employee/director, ownership | multipart upload (PNG/JPEG/WebP, magic-byte verified, ≤ 2 MiB) |
| `GET /signatures/:id` | session, ownership/role | stream private bytes |

Conventions: success envelope `{ ok: true, data }` (lists add
`meta.pagination`); errors `{ ok: false, error: { code, message, details? } }`.
Ownership violations return **404** (no existence leak); conflicts **409**;
oversized uploads **413**; bad MIME **415**; validation **400
`VALIDATION_FAILED`**.

## 15. Authentication & Sessions

- **Login** (`POST /auth/login`) verifies bcrypt (cost 12) against the
  database, creates a revocable `auth_sessions` row, and returns the JWT
  **only** via an HttpOnly cookie (`pspl_session` in dev;
  `__Host-pspl_session` + `Secure` in production). Failures always return the
  same generic `401 Invalid email or password.`
- **CSRF**: unsafe authenticated requests must send `x-csrf-token` matching the
  session's synchronizer token (constant-time compare). Login also validates
  the `Origin` header against the CORS allowlist.
- **Revocation**: logout sets `revokedAt`; the session row is checked on every
  request, so a copied cookie dies immediately regardless of JWT expiry.
- **Rate limiting**: per-IP login limiter (`429 RATE_LIMITED`) plus a baseline
  API limiter.
- Tokens are **never** placed in URLs, `localStorage` or `sessionStorage`
  (asserted by E2E test 14i).

## 16. Role-Based Access Control

| Capability | EMPLOYEE | DIRECTOR | ACCOUNTS |
| :--- | :---: | :---: | :---: |
| View own vouchers | ✅ | — | — |
| View org-wide vouchers | ❌ | ✅ | ✅ |
| Create/edit/delete drafts | ✅ (own, DRAFT) | ❌ | ❌ |
| Submit for approval | ✅ (own, DRAFT) | ❌ | ❌ |
| Approve / reject | ❌ | ✅ (PENDING_APPROVAL only) | ❌ |
| Upload employee signature | ✅ (own voucher) | ❌ | ❌ |
| Upload director signature | ❌ | ✅ (pending voucher) | ❌ |
| View signature bytes | own | org-wide | org-wide |
| Analytics / dashboards | own data | org-wide | org-wide |
| Mutations of any kind | drafts only | decisions only | ❌ **none** |

Enforcement is server-side (`requireAuth`, `requireRole`, ownership policies
in the service layer). Wrong role → `403 FORBIDDEN`; anonymous → `401
UNAUTHORIZED`; another user's voucher → `404` (ownership hidden).

## 17. Signature Vault

- Uploads are `multipart/form-data` via `POST /api/v1/signatures/upload`.
- **Content is verified by magic bytes** (`file-type`), not the client MIME.
- Accepted: PNG, JPEG, WebP; max **2 MiB** (`413` beyond, `415` for other types).
- Storage keys are **server-generated** (sharded `aa/bb/<uuid>.png`) — never a
  user-supplied filename; path traversal is structurally impossible.
- Bytes live in `SIGNATURE_STORAGE_DIR` (local filesystem in this deployment);
  PostgreSQL stores only metadata + SHA-256.
- One employee + one director signature per voucher (`@@unique([voucherId, type])`);
  re-upload replaces atomically.
- Reads (`GET /signatures/:id`) require authentication plus ownership/role
  checks before any byte is streamed.
- The frontend also offers a **canvas SignaturePad** (draw with mouse/
  trackpad/touch) that rasterizes to a PNG and goes through the identical
  upload pipeline.

## 18. Analytics

Role-scoped aggregation endpoints (employees see only their own data;
Director/Accounts see organization-wide):

- `GET /vouchers/analytics/status` — counts per status
- `GET /vouchers/analytics/trends` — expense totals over time (daily/weekly/monthly granularity)
- `GET /vouchers/analytics/categories` — totals grouped by expense category
- `GET /vouchers/activity` — recent timeline events
- Dashboards: `GET /vouchers/dashboard` (employee), `/director/dashboard`, `/accounts/dashboard`

All aggregates are computed in SQL (Prisma group-by) against the real
database — never from client-side arrays.

## 19. Print & PDF Export

The shared `VoucherDocument` component renders an A4-friendly receipt with
employee and director signatures, amounts and the audit timeline. The
**Print / Save as PDF** button calls `window.print()`; dedicated `@media print`
CSS hides navigation and chrome (asserted by E2E tests P1–P3 at employee,
director and accounts scopes).

## 20. Running Tests

### Backend (Vitest + Supertest, real PostgreSQL)

```bash
cd server
npm test                # unit only (no DB needed)
npm run test:integration# API tests against the dev database
npm run test:all        # everything (CI gate)
```

Integration tests expect the dev database on `127.0.0.1:5433` (start
`docker-compose.dev.yml` first). `fileParallelism` is disabled in the Vitest
config — do not re-enable it; the suite shares one database.

### Frontend (Playwright, bundled Chromium)

```bash
cd client
npm run test:e2e        # 33 specs, project "chromium"
```

- Playwright starts (or reuses) Vite on `5173` via the `webServer` block.
- The suite **mocks** `/api/v1/*` through route interception; the backend does
  not need to be running. Application code contains no fake identity — mocks
  exist only in the test harness.
- Always pass `--project chromium` (the default); never `--project edge`.
- Artifacts: `client/test-results/` (HTML report + screenshots).

### Typecheck & lint

```bash
cd server && npm run typecheck && npm run lint
cd client && npx tsc -b && npm run lint
```

## 21. Test Coverage Summary

Revalidated on the current commit (see [`PHASE_TRACKER.md`](PHASE_TRACKER.md)
for run evidence):

| Suite | Count | Status |
| :--- | :---: | :--- |
| Backend unit + integration (Vitest) | **355 tests / 21 files** | ✅ all passing (~3 min) |
| Playwright E2E (Chromium) | **33 tests** | ✅ all passing (~2.6 min) |
| Client typecheck (`tsc -b`) | — | ✅ exit 0 |
| Server typecheck (`tsc --noEmit`) | — | ✅ exit 0 |
| Client + server lint (oxlint) | — | ✅ exit 0 |
| `npm audit` (both packages) | — | ✅ 0 vulnerabilities |

Backend suites cover auth (login, sessions, CSRF, RBAC), voucher CRUD +
ownership/IDOR matrices, the full workflow state machine (happy path,
rejection, terminal-state locks, concurrent-decision safety), signatures
(upload validation, vault streaming, replacement), analytics aggregates
asserted against database facts, and a Phase 9 lifecycle journey (17 tests)
that exercises the complete employee→director→accounts story.

## 22. Code Quality

- **TypeScript strict** everywhere; generated Prisma client is typed TS.
- **oxlint** for both packages (zero errors; pre-existing fast-refresh
  warnings only).
- **Zod** validates every request body/query and the environment at boot.
- **npm audit**: 0 vulnerabilities in both `server/` and `client/`
  (dependabot-style `overrides` pin `mysql2` ≥ 3.24.5 and `deepmerge-ts` ≥ 8.0.2).
- No floating-point arithmetic on money; voucher numbers regex-validated.
- Secrets are never logged (pino redaction), returned by APIs, or committed
  (`.env` gitignored; demo credentials file gitignored).

## 23. Demo Accounts

The seed creates four users on `@pspl.test`:

| Email | Role |
| :--- | :--- |
| `rajesh.kumar@pspl.test` | EMPLOYEE |
| `priya.sharma@pspl.test` | EMPLOYEE |
| `arun.patel@pspl.test` | DIRECTOR |
| `meera.nair@pspl.test` | ACCOUNTS |

There is **no universal default password**. Accounts ship with
`passwordHash = NULL` until you provision them locally:

```bash
cd server
# Requires DEMO_AUTH_ENABLED=true and one independent password per account
# (each DEMO_*_PASSWORD env var, minimum 12 characters) in server/.env.
npm run auth:provision-demo
```

The command is refused in production, never changes roles, never prints
passwords or hashes, and only touches the seeded `@pspl.test` accounts.
**Demo passwords are development-only secrets** — rotate them before any
shared demo, and never commit them.

## 24. Demo Guide

A step-by-step presenter script (login as each role, create→submit→approve,
rejection with reason, Accounts register + analytics + print) lives in
[`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md). Screenshots of each major screen
are in [`docs/screenshots/`](docs/screenshots/).

## 25. Deployment Status

> **BLOCKED — no live deployment.** This submission ships deployment-ready
> configuration and runbooks but **no hosted URL**, because no hosting
> provider, managed database or deployment credentials have been provisioned
> for this project. No fake or placeholder URLs are published anywhere.

What exists today:

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — production runbook
  (environment, migrations, build, health checks, persistent signature volume).
- [`server/render.yaml`](server/render.yaml) — hosting manifest **without
  secrets** (placeholders only).
- Hard production guards already in code: placeholder `JWT_SECRET` refused,
  `DEMO_AUTH_ENABLED=true` refused, `__Host-` secure cookie enforced.

What a live deployment still requires (exact prerequisites):

1. A hosting account (e.g. Render / Railway / Fly.io / VM) with **HTTPS**.
2. A managed PostgreSQL instance (any host; only the dev compose pins 5433).
3. A **persistent disk** (or object storage) mounted at `SIGNATURE_STORAGE_DIR`
   — the local vault is not ephemeral-filesystem safe.
4. Injected secrets: `DATABASE_URL`, a fresh ≥ 64-char `JWT_SECRET`,
   `CORS_ORIGINS` set to the real frontend origin.
5. `NODE_ENV=production`, then `npm run prisma:migrate:deploy` and
   `npm run build && npm start` in `server/`; static `client/dist` served by
   any static host or the same process behind a reverse proxy.

## 26. Production Build & Start

```bash
# Backend
cd server
npm run build            # prisma generate + tsc → dist/
NODE_ENV=production npm start

# Frontend
cd client
npm run build            # tsc -b && vite build → dist/
# serve dist/ with any static file server, or preview locally:
npm run preview
```

The SPA must be served over **HTTPS** in production so the `__Host-` cookie
prefix works; set `CORS_ORIGINS` to the exact origin(s).

## 27. Security Summary

Full threat-oriented write-up: [`docs/SECURITY.md`](docs/SECURITY.md).

Highlights:

- HttpOnly, SameSite=Lax session cookies; JWT never in JS-readable storage
- Server-side revocable sessions (logout is immediate)
- CSRF synchronizer token + login Origin validation
- bcrypt cost 12; generic credential-failure messages (no user enumeration)
- Strict CORS allowlist (wildcards rejected)
- Per-IP rate limits on login and API
- RBAC + ownership checks on every endpoint; IDOR tests assert 404s
- Magic-byte file validation; opaque storage keys; private streaming endpoint
- Helmet security headers; structured logs with credential redaction
- Money as DECIMAL; SQL aggregates server-side
- `.env` and credential files gitignored; placeholder secrets refused at boot

## 28. Troubleshooting

| Symptom | Fix |
| :--- | :--- |
| `Invalid environment configuration...` on API start | Copy `server/.env.example` → `server/.env`; set a real `JWT_SECRET` (≥ 32 bytes) and the correct `DATABASE_URL` |
| `ECONNREFUSED 127.0.0.1:5433` | Start the dev DB: `docker compose -f docker-compose.dev.yml up -d` |
| Prisma client errors after clone | `cd server && npm run prisma:generate` |
| Migrations missing | `npm run prisma:migrate:deploy` then `npm run prisma:seed` |
| Playwright browser missing | `npx playwright install chromium` |
| E2E fails with "project edge not found" | Use the default `chromium` project; do not pass `--project edge` |
| Port 3000/5173 already in use | Stop the other process or change `PORT` / Vite port |
| 502/console errors on `/api` in E2E | Expected: the API is mocked or the backend is down; the suite does not need the backend |
| Login always 412/429 | Rate limited — wait, or raise `RATE_LIMIT_LOGIN_MAX` locally |
| `prisma migrate reset` temptation | **Never** run destructive DB commands against shared data |

## 29. Known Limitations

- **No live deployment** (see [§25](#25-deployment-status)) — configuration and
  runbook are ready; hosting is not provisioned.
- Signature bytes use a **local filesystem vault**; multi-instance or
  ephemeral-disk hosts need object storage (the storage layer is already an
  interface, so swapping is localized).
- The E2E suite runs against **mocked API responses** (documented harness), so
  browser↔real-API integration is covered by backend integration tests plus
  manual verification, not by the Playwright suite.
- Email notifications (e.g. "voucher rejected") are out of scope.
- Password reset / self-service signup are out of scope (accounts are seeded
  and provisioned by an operator).

## 30. Documentation Index

| Document | Contents |
| :--- | :--- |
| [`README.md`](README.md) | this overview + setup |
| [`docs/API.md`](docs/API.md) | full API reference |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | production runbook + blocker details |
| [`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md) | presenter script |
| [`docs/SECURITY.md`](docs/SECURITY.md) | threat model & controls |
| [`docs/FINAL_ACCEPTANCE_CHECKLIST.md`](docs/FINAL_ACCEPTANCE_CHECKLIST.md) | requirement-by-requirement acceptance |
| [`docs/screenshots/`](docs/screenshots/) | UI screenshots |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | system design |
| [`PROJECT_PLAN.md`](PROJECT_PLAN.md) | 10-phase roadmap |
| [`REQUIREMENTS_TRACEABILITY.md`](REQUIREMENTS_TRACEABILITY.md) | RTM |
| [`PHASE_TRACKER.md`](PHASE_TRACKER.md) | milestone status + evidence |
| [`server/README.md`](server/README.md) | backend-specific notes |

## 31. Requirements Traceability

All functional requirements (REQ-AUTH-01…03, REQ-EMP-01…11, REQ-DIR-01…07,
REQ-ACC-01…06, REQ-SEC-01…02, REQ-DEV-01…03) are mapped to components, tests
and delivery status in
[`REQUIREMENTS_TRACEABILITY.md`](REQUIREMENTS_TRACEABILITY.md), with the final
PASS/FAIL/BLOCKED verdicts in
[`docs/FINAL_ACCEPTANCE_CHECKLIST.md`](docs/FINAL_ACCEPTANCE_CHECKLIST.md).

## 32. Project Status (Phase History)

| Phase | Milestone | Status |
| :---: | :--- | :---: |
| 1 | Repository Audit & Architecture Blueprint | ✅ |
| 2 | Design System & Application Shell | ✅ |
| 3 | Database, Backend & API Foundation | ✅ |
| 4 | Authentication, Sessions & RBAC | ✅ |
| 5 | Employee Portal & Draft Lifecycle | ✅ |
| 6 | Director Approval Command Center | ✅ |
| 7 | Accounts Workspace & Analytics | ✅ |
| 8 | Signature Vault & Export Excellence | ✅ |
| 9 | Comprehensive Testing & Security Audit | ✅ |
| 10 | Documentation, Deployment, Final Acceptance | ✅ docs & acceptance; ⚠️ live hosting **blocked** |

Per-phase evidence: [`PHASE_TRACKER.md`](PHASE_TRACKER.md).

## 33. License

Internal academic project for Prachay Securities Private Limited (PSPL).
All rights reserved.
