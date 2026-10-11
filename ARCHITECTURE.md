# System Architecture & Technical Specifications
## Prachay Securities Private Limited (PSPL) - Expense Voucher Management System

---

## 1. Executive Architecture Overview

The **PSPL Expense Voucher Management System** is architected as a modern, decoupled client-server full-stack application designed for financial rigor, granular role-based authorization, enterprise auditability, and sub-second interaction speed.

```mermaid
graph TB
    subgraph Client Layer [Frontend Client - React 18 + TypeScript + Vite]
        UI[Tailwind CSS + Framer Motion UI Components]
        State[Zustand Store / TanStack Query Client]
        Router[Protected React Router v6]
    end

    subgraph Gateway Layer [Express API Gateway & Security]
        CORS[CORS & Helmet Security Headers]
        RateLimit[Rate Limiter]
        AuthGuard[JWT Cookie Auth & RBAC Middleware]
        Validator[Zod Schema Request Validation]
    end

    subgraph Service Layer [Express Modular Domain Services]
        AuthSvc[Auth & Session Service]
        VoucherSvc[Voucher State Machine & CRUD Service]
        ApprovalSvc[Director Decision Workflow Service]
        DashboardSvc[Real-Time Analytics & Aggregation Service]
        MediaSvc[Secure Signature Vault Service]
        AuditSvc[Audit Trail & Activity Log Service]
    end

    subgraph Persistence Layer [PostgreSQL & Storage]
        Prisma[Prisma ORM v5 / Client]
        PG[(PostgreSQL 16+ Database)]
        FS[(Access-Controlled Signature Vault)]
    end

    UI --> State
    State --> Router
    Router -->|HTTPS / REST API / v1| CORS
    CORS --> RateLimit
    RateLimit --> AuthGuard
    AuthGuard --> Validator
    Validator --> AuthSvc
    Validator --> VoucherSvc
    Validator --> ApprovalSvc
    Validator --> DashboardSvc
    Validator --> MediaSvc

    AuthSvc --> Prisma
    VoucherSvc --> Prisma
    ApprovalSvc --> Prisma
    DashboardSvc --> Prisma
    AuditSvc --> Prisma
    MediaSvc --> FS
    MediaSvc --> Prisma
    Prisma --> PG
```

---

## 2. Frontend / Backend Architectural Boundaries

### 2.1 Clean Separation of Concerns
1. **Frontend (`/client`)**:
   - Single Page Application (SPA) powered by Vite, React 18, and TypeScript.
   - Zero business rule validation trust: Frontend forms run client-side validation for instant UX feedback using Zod and React Hook Form, but all domain validations, role checks, and transitions are re-evaluated strictly on the server.
   - Client-side token storage relies on `httpOnly`, `SameSite=Lax`, and `Secure` cookies or memory sessions with CSRF protection to mitigate XSS exposure.
   - Theme and UI system engineered using Tailwind CSS, Lucide React icons, and Framer Motion micro-interactions.

2. **Backend (`/server`)**:
   - Node.js LTS with Express and TypeScript.
   - Strict 3-tier layering: `Routes -> Controllers -> Services -> Data Access (Prisma)`.
   - All state transitions (Draft -> Submitted -> Pending Approval -> Approved / Rejected) are atomic and executed inside PostgreSQL database transactions.
   - Standardized API response envelope and centralized error handler.

---

## 3. Request & Response Lifecycle Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Client (Browser)
    participant GW as Express Gateway / Security
    participant Auth as Auth & RBAC Middleware
    participant Val as Zod Request Validator
    participant Ctrl as Domain Controller
    participant Svc as Business Service
    participant DB as PostgreSQL via Prisma
    participant Vault as Secure Signature Vault

    User->>GW: HTTP Request (JSON / multipart) with Auth Cookie
    GW->>Auth: Verify JWT & Extract User Context
    alt Token Invalid / Expired
        Auth-->>User: 401 Unauthorized { success: false, error: "UNAUTHORIZED" }
    end
    Auth->>Val: Check Role Permissions (EMPLOYEE | DIRECTOR | ACCOUNTS)
    alt Insufficient Privileges
        Val-->>User: 403 Forbidden { success: false, error: "FORBIDDEN" }
    end
    Val->>Val: Validate Schema (Body, Params, Query)
    alt Validation Fails
        Val-->>User: 422 Unprocessable Entity { success: false, details: [...] }
    end
    Val->>Ctrl: Invoke Controller Action
    Ctrl->>Svc: Execute Business Logic & State Checks
    alt File Upload (Signature)
        Svc->>Vault: Write Signature File (MIME & Magic Bytes verified)
    end
    Svc->>DB: Atomic Transaction (Query / Mutation / Audit Log)
    DB-->>Svc: Persisted Record
    Svc-->>Ctrl: Service Result Model
    Ctrl-->>User: HTTP 200/201 Envelope { success: true, data: {...} }
```

### 3.1 Standardized API Response Envelopes

#### Success Envelope (`200 OK`, `201 Created`):
```json
{
  "success": true,
  "data": {
    "voucher": {
      "id": "clt9821abc0001",
      "voucherNumber": "VCH-2026-00042",
      "status": "PENDING_APPROVAL",
      "amount": 14500.00
    }
  },
  "meta": {
    "timestamp": "2026-10-10T12:00:00.000Z",
    "requestId": "req-987214"
  }
}
```

#### Error Envelope (`400`, `401`, `403`, `404`, `409`, `422`, `500`):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Expense amount must be greater than zero.",
    "details": [
      {
        "field": "amount",
        "issue": "Amount must be a positive number"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-10-10T12:00:00.000Z",
    "requestId": "req-987214"
  }
}
```

---

## 4. Authentication, Session & Authorization Flow

### 4.1 Role Matrix & Permissions

| Action / Capability | Employee | Director | Accounts |
| :--- | :---: | :---: | :---: |
| Authenticate & Retrieve Self Profile | Yes | Yes | Yes |
| Create Voucher (Draft) | Yes | No | No |
| Edit Own Voucher (Draft only) | Yes | No | No |
| Delete Own Voucher (Draft only) | Yes | No | No |
| Upload Employee Signature | Yes | No | No |
| Submit Own Voucher for Approval | Yes | No | No |
| View Own Vouchers (All Statuses) | Yes | No | No |
| View Others' Vouchers | **No** | Yes | Yes |
| Search & Filter Organization-Wide Vouchers | No | Yes | Yes |
| Approve Voucher (Pending Approval only) | No | Yes | No |
| Reject Voucher (Pending Approval only, mandatory reason) | No | Yes | No |
| Upload Director Signature for Approval | No | Yes | No |
| Modify Voucher Data After Submission | **No** | **No** | **No** |
| View Approved Vouchers for Reimbursement | Yes (Own) | Yes (Org) | Yes (Org) |
| Download / Print Formatted Voucher PDF | Yes (Own) | Yes (Org) | Yes (Org) |

### 4.2 JWT Session Model
- **Token Delivery**: Signed JWT with standard claims (`sub: userId`, `email`, `role`, `iat`, `exp`).
- **Storage**: Sealed in an `httpOnly`, `Secure` (in production), `SameSite=Lax` cookie (`pspl_session`).
- **Signature Algorithm**: HMAC-SHA256 (`HS256`) or RSA-SHA256 (`RS256`) configured via `JWT_SECRET`.
- **Duration**: Configurable (default 8 hours matching standard business shifts).
- **Revocation / Invalidation**: Server-side user status check (`isActive: true`) on every protected request.

---

## 5. Voucher Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Employee Creates Voucher
    
    state DRAFT {
        [*] --> DraftEditable
        DraftEditable: Mutable by Employee
        DraftEditable: Signature Optional
        DraftEditable: Deletable by Employee
    }

    DRAFT --> SUBMITTED: Employee Submits\n(Validates: Dept, Title, Date, Amount > 0, Employee Sig)
    
    state SUBMITTED {
        [*] --> SubmissionAck
        SubmissionAck: Immutable to Employee
        SubmissionAck: Logged in Audit Trail
    }

    SUBMITTED --> PENDING_APPROVAL: Automatic Pipeline Promotion
    
    state PENDING_APPROVAL {
        [*] --> DirectorQueue
        DirectorQueue: Visible in Director Review Queue
        DirectorQueue: Searchable by Director & Accounts
        DirectorQueue: Read-only to Employee
    }

    PENDING_APPROVAL --> APPROVED: Director Approves\n(Director Signature Mandatory)
    PENDING_APPROVAL --> REJECTED: Director Rejects\n(Mandatory Rejection Reason)

    state APPROVED {
        [*] --> FinalApproved
        FinalApproved: Permanently Immutable
        FinalApproved: Available for Accounts Reimbursement
        FinalApproved: Exportable / Printable
    }

    state REJECTED {
        [*] --> FinalRejected
        FinalRejected: Permanently Immutable
        FinalRejected: Shows Reason to Employee
    }

    APPROVED --> [*]
    REJECTED --> [*]
```

### 5.1 Formal Transition Invariants
1. **DRAFT -> SUBMITTED**:
   - Guard conditions:
     - `voucher.userId === currentUser.id`
     - `voucher.department.trim().length > 0`
     - `voucher.expenseTitle.trim().length > 0`
     - `voucher.expenseDate <= today`
     - `voucher.amount > 0`
     - `voucher.employeeSignatureUrl != null`
   - Outcome: Voucher status transitions to `SUBMITTED`, then automatically into `PENDING_APPROVAL` with `submittedAt = NOW()`.
2. **PENDING_APPROVAL -> APPROVED**:
   - Guard conditions:
     - `currentUser.role === 'DIRECTOR'`
     - `voucher.status === 'PENDING_APPROVAL' || voucher.status === 'SUBMITTED'`
     - `directorSignatureUrl != null`
   - Outcome: `status = 'APPROVED'`, `approvedAt = NOW()`, `approvedById = currentUser.id`. Record becomes permanently immutable.
3. **PENDING_APPROVAL -> REJECTED**:
   - Guard conditions:
     - `currentUser.role === 'DIRECTOR'`
     - `voucher.status === 'PENDING_APPROVAL' || voucher.status === 'SUBMITTED'`
     - `rejectionReason.trim().length >= 5` (meaningful explanation mandatory)
   - Outcome: `status = 'REJECTED'`, `rejectedAt = NOW()`, `rejectedById = currentUser.id`. Record becomes permanently immutable.
4. **Prohibited Transitions**:
   - `APPROVED -> any other state` (BLOCKED)
   - `REJECTED -> any other state` (BLOCKED)
   - `PENDING_APPROVAL -> DRAFT` (BLOCKED)
   - `SUBMITTED -> DRAFT` (BLOCKED)

---

## 6. Database Entity Relationship Model (Prisma / PostgreSQL)

```mermaid
erDiagram
    User ||--o{ Voucher : "creates (as Employee)"
    User ||--o{ Voucher : "approves/rejects (as Director)"
    User ||--o{ AuditLog : "triggers"
    Voucher ||--o{ VoucherItem : "contains (optional line items)"
    Voucher ||--o{ AuditLog : "records history"

    User {
        String id PK
        String email UK
        String passwordHash
        String fullName
        String employeeId UK
        String department
        Role role "EMPLOYEE | DIRECTOR | ACCOUNTS"
        Boolean isActive
        DateTime createdAt
        DateTime updatedAt
    }

    Voucher {
        String id PK
        String voucherNumber UK "Collision-Safe Generated"
        DateTime voucherDate
        DateTime expenseDate
        String department
        String expenseTitle
        String expenseCategory
        String expenseDescription
        Decimal amount "Precision 12, Scale 2"
        VoucherStatus status "DRAFT | SUBMITTED | PENDING_APPROVAL | APPROVED | REJECTED"
        String employeeSignatureUrl
        String directorSignatureUrl
        String rejectionReason
        DateTime submittedAt
        DateTime approvedAt
        DateTime rejectedAt
        String createdById FK
        String reviewedById FK
        DateTime createdAt
        DateTime updatedAt
    }

    AuditLog {
        String id PK
        String voucherId FK
        String userId FK
        String action "CREATED | UPDATED | SUBMITTED | APPROVED | REJECTED"
        Json metadata
        String ipAddress
        DateTime timestamp
    }
```

### 6.1 Collision-Safe Unique Voucher Number Strategy
- Format: `VCH-YYYYMMDD-XXXX` (e.g. `VCH-20261010-0001`) or sequence-backed `VCH-YYYY-XXXXX`.
- Generated inside an isolated database sequence or atomic transaction with unique constraint on `voucherNumber`.
- In case of rare concurrency race, a retry loop with exponential backoff guarantees uniqueness without deadlock.

---

## 7. Secure Signature Upload & Retrieval Vault

### 7.1 Threat Model for Signatures
Signatures are sensitive legal and financial assets. Public URL buckets or unauthenticated static folder serving (`/static/signatures/...`) expose employee and director signatures to unauthorized harvesting.

### 7.2 Secure Vault Architecture
1. **Upload Phase**:
   - Transport: `POST /api/v1/uploads/signature` with multipart form data.
   - Size limit: 2 MB maximum.
   - Allowed MIME types: `image/png`, `image/jpeg`, `image/webp`.
   - Magic byte verification: Validates file signature headers using buffer inspection, not just client filename extensions.
   - Storage Path: Local secure storage `/server/uploads/signatures/<hashed_filename>.<ext>` (or S3/Cloud Storage in production).
   - Database record: Stored as protected URI reference (e.g., `/api/v1/signatures/:id`).

2. **Access Control Phase**:
   - Signature retrieval is routed through an authenticated endpoint: `GET /api/v1/signatures/:signatureId`.
   - Authorization check:
     - Employee may only view signatures associated with their own vouchers.
     - Director and Accounts can view signatures attached to any voucher within the organization.
     - Unauthenticated or unauthorized requests receive `403 Forbidden`.
   - Content delivery: Streams with `Cache-Control: private, no-transform, max-age=3600` and `Content-Disposition: inline`.

---

## 8. Dashboard Aggregation Strategy (Real-Time Performance)

To avoid in-memory filtering that degrades at scale, dashboard statistics are computed using indexed PostgreSQL aggregate queries.

### 8.1 Employee Dashboard Aggregation
```sql
SELECT
    COUNT(*) AS total_vouchers,
    COUNT(*) FILTER (WHERE status = 'DRAFT') AS draft_vouchers,
    COUNT(*) FILTER (WHERE status IN ('SUBMITTED', 'PENDING_APPROVAL')) AS pending_approval,
    COUNT(*) FILTER (WHERE status = 'APPROVED') AS approved_vouchers,
    COUNT(*) FILTER (WHERE status = 'REJECTED') AS rejected_vouchers,
    COALESCE(SUM(amount), 0.00) AS total_amount_claimed
FROM "Voucher"
WHERE "createdById" = :currentUserId;
```

### 8.2 Director Dashboard Aggregation
```sql
SELECT
    COUNT(*) FILTER (WHERE status IN ('SUBMITTED', 'PENDING_APPROVAL')) AS pending_approval_count,
    COUNT(*) FILTER (WHERE status = 'APPROVED' AND "approvedAt" >= CURRENT_DATE) AS approved_today,
    COUNT(*) FILTER (WHERE status = 'REJECTED' AND "rejectedAt" >= CURRENT_DATE) AS rejected_today,
    COALESCE(SUM(amount) FILTER (WHERE status IN ('SUBMITTED', 'PENDING_APPROVAL')), 0.00) AS total_pending_amount
FROM "Voucher";
```

### 8.3 Accounts Dashboard Aggregation
```sql
SELECT
    COUNT(*) AS total_vouchers,
    COUNT(*) FILTER (WHERE status IN ('SUBMITTED', 'PENDING_APPROVAL')) AS pending_approval,
    COUNT(*) FILTER (WHERE status = 'APPROVED') AS approved_vouchers,
    COUNT(*) FILTER (WHERE status = 'REJECTED') AS rejected_vouchers,
    COALESCE(SUM(amount) FILTER (WHERE status = 'APPROVED'), 0.00) AS total_approved_expense_amount
FROM "Voucher";
```

---

## 9. API Versioning, Routing & Error Conventions

### 9.1 API Hierarchy (`/api/v1`)
- `/api/v1/auth`:
  - `POST /register` (Seed / Admin provisioned)
  - `POST /login` (Issues session cookie)
  - `POST /logout` (Clears session cookie)
  - `GET  /me` (Current authenticated user profile)
- `/api/v1/vouchers`:
  - `GET    /` (List vouchers with query filters, pagination, role-scoped)
  - `POST   /` (Create Draft voucher - Employee only)
  - `GET    /:id` (Get voucher details - Ownership / Role checked)
  - `PUT    /:id` (Update Draft voucher - Owner only, Draft only)
  - `DELETE /:id` (Delete Draft voucher - Owner only, Draft only)
  - `POST   /:id/submit` (Submit Draft voucher for approval - Owner only)
- `/api/v1/approvals`:
  - `POST   /:id/approve` (Approve voucher - Director only)
  - `POST   /:id/reject` (Reject voucher - Director only, requires reason)
- `/api/v1/analytics`:
  - `GET    /dashboard` (Role-specific aggregate KPIs)
- `/api/v1/signatures`:
  - `POST   /upload` (Upload and store signature image)
  - `GET    /:id` (Stream protected signature image)

---

## 10. Configuration & Secret Management

Configuration is strictly centralized via typed environment variables validated at startup:

| Variable | Description | Default / Example | Required |
| :--- | :--- | :--- | :---: |
| `NODE_ENV` | Runtime environment | `development` | Yes |
| `PORT` | API server port | `5000` | Yes |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/pspl_vouchers` | Yes |
| `JWT_SECRET` | Secret key for JWT signing | High-entropy 64-char string | Yes |
| `JWT_EXPIRES_IN` | Session expiration duration | `8h` | Yes |
| `COOKIE_DOMAIN` | Domain for session cookie | `localhost` | No |
| `CLIENT_ORIGIN` | Allowed CORS origin | `http://localhost:5173` | Yes |
| `UPLOAD_DIR` | Local storage directory for signatures | `./uploads/signatures` | Yes |
| `MAX_FILE_SIZE_MB`| Maximum file upload limit | `2` | Yes |

A version-controlled `.env.example` file provides sanitized defaults for development without revealing secrets.

---

## 11. Proposed Directory Structure

```
prachay-group-project/
├── .github/                      # CI/CD Workflows
├── client/                       # Frontend React Application
│   ├── public/                   # Static assets, branding logos
│   ├── src/
│   │   ├── assets/               # SVGs, icons, illustrations
│   │   ├── components/           # Reusable UI component library
│   │   │   ├── common/           # Button, Modal, Card, Input, Badge
│   │   │   ├── layout/           # Navbar, Sidebar, PageHeader, Shell
│   │   │   ├── voucher/          # VoucherCard, VoucherTable, VoucherTimeline
│   │   │   ├── signature/        # SignaturePad, SignaturePreview
│   │   │   └── dashboard/        # StatCard, RecentActivity, TrendChart
│   │   ├── context/              # AuthContext, NotificationContext
│   │   ├── hooks/                # Custom React hooks (useAuth, useVoucher, etc.)
│   │   ├── pages/                # Route pages
│   │   │   ├── auth/             # LoginPage
│   │   │   ├── employee/         # EmployeeDashboard, NewVoucher, VoucherDetail
│   │   │   ├── director/         # DirectorDashboard, ApprovalQueue, ReviewVoucher
│   │   │   └── accounts/         # AccountsDashboard, VoucherRegister, ExportView
│   │   ├── services/             # Typed API client services
│   │   ├── types/                # TypeScript shared domain models
│   │   ├── utils/                # Date formatting, currency, validators
│   │   ├── App.tsx               # Root component with router
│   │   ├── main.tsx              # Application entry point
│   │   └── index.css             # Tailwind base and custom utilities
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                       # Backend Express Application
│   ├── prisma/                   # Prisma schema, migrations, seeders
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── src/
│   │   ├── config/               # Environment & app constants
│   │   ├── constants/            # Role, Status enums, error codes
│   │   ├── controllers/          # Route controller handlers
│   │   ├── middleware/           # Auth, RBAC, Zod validation, error handler
│   │   ├── routes/               # API route definitions
│   │   ├── services/             # Business logic layer
│   │   ├── types/                # Express & domain TypeScript types
│   │   ├── utils/                # Voucher numbering, crypto, logger
│   │   ├── app.ts                # Express app setup
│   │   └── index.ts              # Server bootstrap entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
├── tests/                        # End-to-end and cross-cutting tests
│   ├── e2e/                      # Playwright test suites
│   └── integration/              # Supertest API suites
├── docs/                         # Extended documentation and screenshots
├── .env.example                  # Environment configuration template
├── .gitignore
├── ARCHITECTURE.md               # Technical architecture blueprint
├── PROJECT_PLAN.md               # 10-phase execution roadmap & requirements
├── REQUIREMENTS_TRACEABILITY.md  # Comprehensive requirements matrix
├── UI_UX_BLUEPRINT.md            # Design system, styling & UX specs
├── PHASE_TRACKER.md              # Milestone tracking & phase deliverables
└── README.md                     # Project overview and setup documentation
```

---

## 12. Phase 3 Implementation Decisions

*Added after Phase 3 delivery. These record decisions actually taken where the Phase 1
blueprint left the choice open. Earlier sections remain the original design intent.*

### 12.1 Deviation: Signature & Audit Models

Section 6 sketched `AuditLog` and signature URLs as columns on `Voucher`. The
implementation splits these into two dedicated models, because the blueprint's own
security requirements (section 7) cannot be met by a plain URL column:

- **`signatures`** — holds metadata only (`storageKey`, verified `mimeType`, `sizeBytes`,
  `sha256`, `type`, `uploadedById`). Image bytes live on disk outside PostgreSQL. A
  `@@unique([voucherId, type])` constraint guarantees exactly one current employee and one
  current Director signature per voucher.
- **`voucher_events`** — append-only timeline with `fromStatus`/`toStatus` per event,
  driving the auditable state-transition history. Replaces the single `AuditLog` sketch.

### 12.2 Voucher numbering (refines section 6.1)

Implemented as `VCH-<year>-<6 digits>` (e.g. `VCH-2026-000001`) using a dedicated
PostgreSQL sequence `voucher_number_seq`. `MAX(number) + 1` is never used because it races
under concurrency. Sequence gaps after a rolled-back transaction are acceptable; duplicates
are additionally blocked by a `UNIQUE` constraint.

### 12.3 Lifecycle resolution (clarifies section 5)

Section 5 shows `SUBMITTED` as a distinct resting state. The implementation treats it as a
**transient transition recorded inside the submit transaction**: the audit trail captures both
`DRAFT → SUBMITTED` and `SUBMITTED → PENDING_APPROVAL`, while the voucher row is persisted in
`PENDING_APPROVAL`. This avoids stranding vouchers in an intermediate state.

### 12.4 Database-level integrity

Because Prisma's schema language cannot express check constraints or sequences, the initial
migration appends hand-written SQL adding: the voucher-number sequence, positive-amount
enforcement, "a REJECTED voucher must carry a reason", "an APPROVED voucher must record a
reviewer and timestamp", a signature size ceiling, and a `lower(email)` unique index for
case-insensitive email uniqueness.

### 12.5 Reference data normalization

Section 6 sketched `department` and `expenseCategory` as plain strings on `User`/`Voucher`.
The implementation uses normalized `departments` and `expense_categories` tables with unique
codes, referenced by foreign key. Historical `employeeNameSnapshot` / `employeeIdSnapshot`
columns are retained on `voucher` so past vouchers stay readable if a user or department is
later renamed or deactivated.

### 12.6 Fail-closed phase boundaries

Phase 3 mounts only health and non-sensitive reference-data endpoints. Voucher, approval,
analytics and signature routes exist in the router but are permanently guarded by
`requireAuth`, which rejects every request until Phase 4 supplies real JWT verification. The
signature storage service and its authorization policy are implemented and unit tested, but
no anonymous route can reach them.

## 13. Phase 4 Implementation Decisions (Authentication & Authorization)

Sections 4 and 10 describe the intended design; this section records the decisions actually
shipped, verified by 247 backend tests and a targeted Playwright selection.

### 13.1 Identity, password and JWT

- Login (`POST /api/v1/auth/login`) looks the user up by email, then bcrypt-verifies the
  password (cost 12 via `bcryptjs`). Every credential failure — unknown email, NULL hash
  (unprovisioned account), inactive account, wrong password — returns the byte-identical
  `401 {"code":"UNAUTHORIZED","message":"Invalid email or password."}` so accounts cannot be
  enumerated. Verification runs a dummy comparison for missing hashes to keep timing flat.
- The JWT is signed with **jose** HS256, pinned to one algorithm (no `none`/asymmetric
  downgrade), and carries `sub` (user id), `sid` (session id), `role` (informational only —
  the server always re-reads the role from the database), `iss`, `aud`, `iat`, `exp`, `jti`.
  Expiry defaults to `JWT_TTL_SECONDS` (30 minutes).
- The token is delivered **only** through the session cookie. It never appears in a response
  body, is never readable from JavaScript, and is never logged (the logger redacts cookies,
  authorization headers, tokens, passwords, hashes and secrets at top level and one level
  deep — see `src/utils/logger.ts`).

### 13.2 Cookie policy

Cookie attributes are built in exactly one module, `src/modules/auth/session-cookie.ts`,
used by login, logout and logout-all:

| Attribute | Development (HTTP) | Production (HTTPS) |
| :--- | :--- | :--- |
| Name | `pspl_session` | `__Host-pspl_session` |
| HttpOnly | yes | yes |
| Secure | no | yes |
| SameSite | Lax | Lax |
| Path | `/` | `/` |
| Domain | none (host-only) | none (required by `__Host-`) |

`__Host-` cookies must be Secure, Path=/ and Domain-less; browsers enforce this, so
production HTTP would simply fail. Cookie clearing replays the same attributes so browsers
actually delete it. These properties are asserted directly against the shared helpers by
`tests/unit/production-cookie.test.ts`, which injects a production environment into an
isolated module registry (no .env file is modified).

### 13.3 Sessions and revocation

Each login inserts an `auth_sessions` row (user id, CSRF token hash, expiry, user-agent,
IP). `GET /api/v1/auth/me` and every protected request re-verify: signature → issuer →
audience → expiry → session row still present → session not expired → user still active.
Logout deletes the row (revocation is immediate even though the JWT itself has not expired),
and `POST /auth/logout-all` revokes every session for the user. Because the role is re-read
from the database on every request, demoting or deactivating a user takes effect at once.

### 13.4 CSRF: synchronizer token

State-changing requests (`POST`/`PATCH`/`DELETE`) with a valid cookie must present the
session-bound token in the `x-csrf-token` header. The token is generated per session
(32 random bytes), stored server-side, returned only to the authenticated owner via
`/auth/login` and `/auth/me`, and compared in constant time. Login additionally validates
the `Origin` header against the CORS allowlist (`validateLoginOrigin`), rejecting
cross-site credential submissions before credentials are even checked. Safe methods
(`GET`/`HEAD`/`OPTIONS`) never require CSRF and never mutate state.

### 13.5 CORS, rate limiting and headers

`CORS_ORIGINS` is an explicit allowlist (a wildcard is rejected at config-validation time
because credentialed requests would be unsafe); the CORS middleware answers unlisted
origins with `callback(null, false)` rather than an Error, so arbitrary origins are never
reflected. Per-IP limiters cover login (`RATE_LIMIT_LOGIN_MAX`, default 10/min) and the
baseline API (`RATE_LIMIT_API_MAX`, default 300/min), returning the standard envelope with
`RATE_LIMITED` and `Retry-After`. Helmet supplies the security headers.

### 13.6 Role and resource authorization

`requireAuth` populates `req.user`/`req.auth` from the database-verified session;
`requireRole(...roles)` then gates the route (wrong role → `403 FORBIDDEN`, anonymous →
`401 UNAUTHORIZED`). Resource policies live in `src/middleware/auth-contract.ts` and the
per-module policy services:

- **Employee**: voucher queries are scoped by `createdById` **in the database query**, so
  another employee's voucher is invisible (404, not 403 — existence is not disclosed).
  Editing is allowed only while the voucher is `DRAFT`; any other status returns `409
  INVALID_STATE_TRANSITION`.
- **Director**: organization-wide read; the only role that passes the approve/reject
  authorization gate (the mutation itself is still `501` until Phase 6).
- **Accounts**: organization-wide read, strictly read-only for every mutation.
- Mass assignment is blocked structurally: the login schema is `.strict()` (unknown fields
  like a smuggled `role` are rejected), and voucher PATCH whitelists editable fields —
  owner, reviewer, status, voucher number and timestamps can never be supplied by a client.

### 13.7 Signature access

`GET /api/v1/signatures/:id` requires a valid session, then authorizes with
`canAccessSignature` (Employee: own vouchers only; Director/Accounts: organization-wide),
loading ownership in the same query. Unauthorized and nonexistent ids return the identical
`404` envelope. Bytes are streamed from the private vault with `Cache-Control: private`;
the storage key and filesystem path are never included in any response, and a missing or
poisoned (traversal) storage key degrades to a generic 500/400 envelope without leaking
paths. There is no public static route to the storage directory. `POST
/api/v1/signatures/upload` exists but is closed (`501 NOT_IMPLEMENTED`) behind auth + CSRF
until the Phase 5/6 workflows.

### 13.8 Demo provisioning

`npm run auth:provision-demo` is the only way the seeded `@pspl.test` accounts obtain
passwords. It refuses to run in production or without `DEMO_AUTH_ENABLED=true`, requires
four independent passwords of ≥12 characters supplied via environment variables (no
universal default), hashes them through the same password service, preserves roles and
every other field, is idempotent, and prints no secret material.

### 13.9 Frontend flow

`AuthProvider` (`src/hooks/useAuth.tsx`) holds the user in memory only — no JWT, CSRF token
or identity is written to localStorage/sessionStorage. On mount it calls `/api/v1/auth/me`
to rehydrate; until that resolves, `RequireAuth` renders a loading state so protected
content never flashes. `api.ts` uses `credentials: 'include'` and attaches the in-memory
CSRF token to unsafe requests. Route guards (`RouteGuards.tsx`) allow-list by the
server-reported role; a client-side role change grants nothing because the server is the
only authority. 401 responses (expired/revoked session) clear local state and land on
`/login`. The Phase 2 demo role switcher and `switchRole` bypass are gone.
