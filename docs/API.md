# API Reference — PSPL Expense Voucher Management System

Base URL: **`/api/v1`** (the Vite dev server proxies `/api` → `http://127.0.0.1:3000`).

All timestamps are ISO-8601 (`timestamptz`); all dates are ISO dates
(`YYYY-MM-DD`); all monetary amounts are decimal strings with two fraction
digits (e.g. `"1250.50"`) — never JSON floats.

## Envelopes

**Success**

```json
{ "ok": true, "data": { "...": "..." } }
```

List endpoints return the items under `data.items` with pagination metadata:

```json
{
  "ok": true,
  "data": { "scope": "employee" | "organization", "items": [ /* vouchers */ ] },
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 42,
      "totalPages": 3
    }
  }
}
```

**Error**

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_FAILED" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND"
          | "CONFLICT" | "INVALID_STATE_TRANSITION" | "RATE_LIMITED" | "...",
    "message": "Human-readable explanation.",
    "details": [ /* optional field-level issues */ ]
  }
}
```

Status-code conventions:

| Situation | Code |
| :--- | :--- |
| Malformed body/query (Zod) | 400 `VALIDATION_FAILED` |
| Missing/invalid session | 401 `UNAUTHORIZED` |
| Authenticated but wrong role | 403 `FORBIDDEN` |
| Voucher not owned / not visible | **404** (ownership is hidden — never 403) |
| Illegal state transition or concurrent decision | 409 `CONFLICT` / `INVALID_STATE_TRANSITION` |
| Approve without Director signature; submit without employee signature | 422 |
| Upload > 2 MiB | 413 |
| Upload not PNG/JPEG/WebP (magic bytes) | 415 |
| Too many requests | 429 `RATE_LIMITED` |

---

## Health (public)

| Method | Path | Notes |
| :--- | :--- | :--- |
| GET | `/health` | full check (DB ping) |
| GET | `/health/live` | process liveness |
| GET | `/health/ready` | readiness (DB reachable) |

## Authentication

| Method | Path | Auth | Body / notes |
| :--- | :--- | :--- | :--- |
| POST | `/auth/login` | public, rate-limited (per IP), Origin-checked | `{ "email": "string", "password": "string" }` → sets HttpOnly `pspl_session` cookie; returns sanitized user + CSRF token |
| GET | `/auth/me` | session cookie | current user + CSRF token (rehydration after refresh) |
| POST | `/auth/logout` | session + `x-csrf-token` | revokes this session, clears cookie. Idempotent |
| POST | `/auth/logout-all` | session + `x-csrf-token` | revokes every session for the user |

- Failed logins always return the same generic `401 Invalid email or password.`
- The JWT lives **only** in the cookie; it is never in a response body.
- Unsafe authenticated requests (POST/PATCH/DELETE) must include the
  `x-csrf-token` header matching the session token, or receive 403.

## Reference data (session required)

| Method | Path | Notes |
| :--- | :--- | :--- |
| GET | `/departments` | active departments |
| GET | `/expense-categories` | active expense categories |

## Vouchers — list & detail

### `GET /vouchers`

Scoped automatically: employees receive **only their own** vouchers
(`scope: "employee"`); Directors and Accounts receive the organization-wide
set (`scope: "organization"`).

Query parameters (all optional):

| Param | Type | Example |
| :--- | :--- | :--- |
| `page` | int ≥ 1 | `2` |
| `pageSize` | int 1–100 | `20` |
| `search` | string | matches voucher number, title, employee name |
| `status` | `DRAFT`\|`SUBMITTED`\|`PENDING_APPROVAL`\|`APPROVED`\|`REJECTED` | repeatable |
| `departmentId` | uuid | |
| `expenseCategoryId` | uuid | |
| `dateFrom` / `dateTo` | ISO date | inclusive range on `expenseDate` |
| `sort` | field | e.g. `expenseDate`, `amount`, `createdAt` |
| `order` | `asc`\|`desc` | |

### `GET /vouchers/:id`

Returns the voucher, its signatures (metadata only — no bytes), and
`reviewedByName` when decided. Employee: own vouchers only. Director/Accounts:
any. Another user's voucher → **404**.

## Vouchers — employee mutations

### `POST /vouchers` (EMPLOYEE)

Creates a **DRAFT**. Body is `strict` — unknown keys (status, voucherNumber,
createdById, …) are rejected:

```json
{
  "departmentId": "uuid",
  "expenseTitle": "Client dinner — Bandra",
  "expenseCategoryId": "uuid",
  "expenseDate": "2026-10-01",
  "voucherDate": "2026-10-02",        // optional, defaults to today
  "amount": "2450.00",                 // decimal string or number > 0
  "expenseDescription": "optional, ≤ 4000 chars"
}
```

Response: created voucher incl. server-generated
`voucherNumber` (`VCH-YYYY-NNNNNN`, unique).

### `PATCH /vouchers/:id` (EMPLOYEE, owner, DRAFT only)

Partial update of the same editable fields (all optional). Non-draft → 409.
Not owner → 404. Director/Accounts → 403.

### `DELETE /vouchers/:id` (EMPLOYEE, owner, DRAFT only)

Deletes the draft (signatures cascade). Non-draft → 409.

### `POST /vouchers/:id/submit` (EMPLOYEE, owner, DRAFT only)

Transitions `DRAFT → PENDING_APPROVAL` (persisted via `SUBMITTED` +
`PENDING_APPROVAL` timeline events). Preconditions (422 if missing):
required fields present, amount > 0, **employee signature exists**.
Owner-only (404 for others); wrong state → 409.

### `GET /vouchers/:id/events`

Append-only timeline (`CREATED`, `UPDATED`, `SUBMITTED`, `PENDING_APPROVAL`,
`APPROVED`, `REJECTED`) with actor names and non-sensitive metadata (e.g.
rejection reason).

## Vouchers — Director decisions

Both endpoints require role **DIRECTOR** (others → 403; hidden existence for
non-directors is irrelevant since role is checked first).

### `POST /vouchers/:id/approve`

Transitions `PENDING_APPROVAL → APPROVED` **iff** a DIRECTOR signature exists
on the voucher (else 422) and the voucher is still pending (else 409 —
concurrent decisions resolve to exactly one winner via conditional update).
Records `reviewedById`, `approvedAt`, reviewer name snapshot, and an
`APPROVED` event.

### `POST /vouchers/:id/reject`

```json
{ "reason": "Original receipts missing for the hotel line item." }
```

`reason` is trimmed and must be **≥ 10 characters** (validated before the
state check). Transitions to `REJECTED`, stores the reason, emits a
`REJECTED` event.

## Vouchers — dashboards & analytics (session, role-scoped)

Employees: own data only. Director/Accounts: organization-wide.

| Method | Path | Returns |
| :--- | :--- | :--- |
| GET | `/vouchers/dashboard` | employee KPIs (counts/sums by status) |
| GET | `/vouchers/director/dashboard` | pending count, approved today, totals |
| GET | `/vouchers/accounts/dashboard` | org financial totals & approved count |
| GET | `/vouchers/analytics/status` | counts per status |
| GET | `/vouchers/analytics/trends` | totals over time (`granularity=daily\|weekly\|monthly`) |
| GET | `/vouchers/analytics/categories` | totals per expense category |
| GET | `/vouchers/activity` | recent timeline events (`limit` query) |

Analytics query params: `dateFrom`, `dateTo` (ISO dates), plus
`granularity` on trends. All aggregates are computed in SQL.

## Signatures

### `POST /signatures/upload`

`multipart/form-data`:

| Field | Type | Notes |
| :--- | :--- | :--- |
| `voucherId` | text | uuid (required, strict body) |
| `file` | file | PNG / JPEG / WebP, ≤ 2 MiB; content sniffed via magic bytes |

Authorization:

- **EMPLOYEE**: own voucher, still DRAFT (sign before submitting).
- **DIRECTOR**: any voucher in `PENDING_APPROVAL` (sign at decision time).

One signature per `(voucherId, type)` — re-upload replaces the previous file
(atomically: old bytes deleted after new row written). Type is inferred from
the role (never client-supplied). Oversized → 413; wrong type → 415;
exactly one `file` field expected (else 400).

### `GET /signatures/:id`

Streams the stored bytes with the sniffed `Content-Type` and
`X-Content-Type-Options: nosniff`. Requires authentication plus
ownership/role checks (employee: own vouchers; director/accounts:
organization-wide). The opaque `storageKey` is never exposed.

---

## Rate limits

| Limiter | Default | Response |
| :--- | :--- | :--- |
| Login | 10 / window / IP (`RATE_LIMIT_LOGIN_MAX`) | 429 `RATE_LIMITED` |
| API baseline | 300 / window / IP (`RATE_LIMIT_API_MAX`) | 429 `RATE_LIMITED` |

## CSRF summary

| Request | Header required |
| :--- | :--- |
| `POST /auth/login` | Origin must match CORS allowlist |
| Any other POST / PATCH / DELETE with a session | `x-csrf-token` = session token |
| GET (any) | none (cookie only) |
