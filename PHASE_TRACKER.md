# Ten-Phase Master Development Tracker
## PSPL Expense Voucher Management System

---

## 1. Executive Milestone Summary

| Phase | Milestone Name | Dependencies | Status | Evidence Required |
| :---: | :--- | :--- | :---: | :--- |
| **01** | Repository Audit, Requirements Analysis & Architecture Blueprint | None | **Completed** | Completed architecture blueprint, project plan, RTM, UI/UX specs, .env.example, and clean audit verification. |
| **02** | Premium Fintech Design System & Application Shell | Phase 01 | **Completed** | React + Vite + Tailwind shell initialized, responsive layouts, role preview toggle, component library. |
| **03** | Database, Backend Architecture & API Foundation | Phase 01 | **Completed** | Express + Prisma schema migrations, DB seed script with 3 roles, health checks, error handler. |
| **04** | Secure Authentication, Sessions & Role-Based Authorization | Phase 02, 03 | **Completed** | JWT HTTP-only cookies, bcrypt hashing, RBAC middleware, protected routes on frontend and backend. 247 backend tests green; targeted Playwright auth selection green. |
| **05** | Employee Portal, Voucher Creation & Draft Lifecycle | Phase 04 | **Completed** | Employee dashboard KPIs, draft CRUD, signature pad, submission transition; 307 backend tests green; employee screens wired to real API. |
| **06** | Director Approval Command Center & Decision Workflow | Phase 05 | **Completed** | Director dashboard KPIs, approval queue, review with Director signature, rejection with reason; concurrency-safe approve/reject; Playwright director journeys green. |
| **07** | Accounts Workspace, Organization-Wide Search & Analytics | Phase 06 | **Completed** | Accounts dashboard KPIs + recharts trend, read-only voucher register with server-side filters, shared analytics query contract; 338 backend tests green. |
| **08** | Signature Experience, Document Export & Final Visual Excellence | Phase 07 | **Completed** | Shared VoucherDocument across all 3 roles, protected signature streaming, print stylesheet + Playwright print/signature tests (P1-P3), responsive overflow checks at 4 viewports. |
| **09** | Comprehensive Testing, Security Audit & End-to-End Bug Fixing | Phase 08 | **Completed** | 355 backend tests (21 files) + 33 Playwright E2E all green; lifecycle/IDOR/terminal-state integration suite; demo seed covers full lifecycle with synthetic signatures; npm audit 0 vulnerabilities (prod + dev). |
| **10** | Documentation, Deployment, Final Acceptance & Submission | Phase 09 | **Completed (deployment BLOCKED)** | README (33 sections), docs/API.md + DEPLOYMENT.md + DEMO_GUIDE.md + SECURITY.md + FINAL_ACCEPTANCE_CHECKLIST.md, 12 screenshots, docker-compose dev DB (5433), hosting manifest (no secrets), secret scan clean, 0 audit vulns, final commit `8da7b43` pushed to verified remote. Live deployment BLOCKED (no hosting provider/managed DB/provisioned credentials) — documented, no fake URLs. |

---

## 2. Detailed Phase Specifications

### Phase 01: Repository Audit, Requirements Analysis & Architecture Blueprint
- **Scope**: Repository inspection, environment audit, assignment requirements decomposition, architecture specifications, UI/UX design tokens, and master planning documentation.
- **Dependencies**: None.
- **Deliverables**:
  - `ARCHITECTURE.md`
  - `PROJECT_PLAN.md`
  - `REQUIREMENTS_TRACEABILITY.md`
  - `UI_UX_BLUEPRINT.md`
  - `PHASE_TRACKER.md`
  - `.env.example`
- **Acceptance Criteria**:
  - All 5 core planning files authored and internally consistent.
  - Zero unverified assumptions; explicit documentation of PDF exclusion.
  - Three user roles (`EMPLOYEE`, `DIRECTOR`, `ACCOUNTS`) and five-state lifecycle (`DRAFT`, `SUBMITTED`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`) modeled without contradiction.
- **Current Status**: Completed.

---

### Phase 02: Premium Fintech Design System & Application Shell
- **Scope**: Initialize frontend React TypeScript application using Vite; configure Tailwind CSS with institutional dark tokens; build atomic design components (buttons, badges, inputs, modals, cards); assemble application shell with top bar and collapsible sidebar.
- **Dependencies**: Phase 01.
- **Deliverables**:
  - `client/` workspace initialization
  - Tailwind v4 token configuration (CSS-first `@theme` in `src/index.css`; `tailwind.config.ts` removed)
  - Reusable component library (`components/common/*`, `forms`, `data-display`, `overlays`, `feedback`)
  - Responsive layout shell (`components/layout/Shell.tsx`, `Sidebar.tsx`, `TopNav.tsx`)
  - Playwright browser automation suite (`tests/e2e/app.spec.ts`, `playwright.config.ts`)
- **Acceptance Criteria**:
  - Clean Vite dev server execution on `http://127.0.0.1:5173`.
  - Accessible color contrast and focus rings across all core components.
  - Interactive role-preview switcher allowing navigation of all planned screen layouts.
  - `/` redirects to `/login`; unknown URLs render a Not Found page.
  - All core routes verified by real browser rendering, not HTTP status alone.
- **Verification Evidence (actual results)**:
  - Blank-screen defect fixed: `DemoAuthProvider` invoked the React context Provider as a plain function, unmounting the whole tree. Corrected to `<DemoAuthContext.Provider value={...}>`.
  - `npm run lint` (oxlint): 0 errors, 2 warnings — both `react(only-export-components)` advisories for the standard context-provider + hook file pattern (`useDemoAuth.tsx`, `Toast.tsx`). Reduced from 66 warnings.
  - `npm run build` (`tsc -b && vite build`): PASS. TypeScript compiles clean; production bundle emitted.
  - `npm run test:e2e` (Playwright + installed Microsoft Edge, no browser download): **21 passed, 0 failed, 0 skipped**.
  - Route coverage verified in a real browser: `/login`, `/employee`, `/employee/vouchers`, `/employee/vouchers/new`, `/employee/vouchers/:id`, `/director`, `/director/approvals`, `/director/vouchers/:id`, `/accounts`, `/accounts/vouchers`, `/accounts/vouchers/:id`, plus `/` redirect and Not Found.
  - Zero uncaught page errors, zero console errors, zero failed network requests across all core screens.
  - Responsive checks with no unintended horizontal page overflow: 375px, 768px, 1440px, 2560px.
  - Screenshots: `client/test-results/screenshots/` (login, employee dashboard, director approval queue, accounts dashboard).
- **Current Status**: Completed (frontend/demo only).
- **Not implemented in Phase 02** (deferred to later phases): backend authentication, authorization enforcement, database persistence, voucher mutation/save/submit, and real PDF export. All displayed records are fictional in-memory demo data in `src/data/demo-data.ts`.

---

### Phase 03: Database, Backend Architecture & API Foundation
- **Scope**: Initialize backend Express TypeScript application; configure Prisma ORM with PostgreSQL database connection; model users, vouchers, and audit logs; write database migration; construct repeatable seed script generating users for all 3 roles and initial vouchers.
- **Dependencies**: Phase 01.
- **Deliverables**:
  - `server/` workspace initialization
  - `prisma/schema.prisma` with constraints and indexes
  - Database migration files (`prisma/migrations/*`)
  - Repeatable seed script (`prisma/seed.ts`)
  - Centralized Express error handler and logger
- **Acceptance Criteria**:
  - `npx prisma migrate dev` executes cleanly against local PostgreSQL.
  - `npx prisma db seed` successfully populates database with test accounts.
  - Health endpoint `GET /api/v1/health` returns HTTP 200 with DB connectivity confirmed.
- **Verification Evidence (actual results)**:
  - Stack: Express 5.3, Prisma 7.10 (+`@prisma/adapter-pg`), PostgreSQL 18, TypeScript 5.9, Zod 4, Pino, Vitest + Supertest.
  - **Clean-database migration verified**: created a separate `pspl_voucher_test` database, confirmed it empty, then ran `prisma migrate deploy`. Result: 7 tables, 4 enums, 1 sequence, 4 CHECK constraints created from committed migration files alone.
  - Migration applied to the dev database too; `prisma migrate status` reports "Database schema is up to date".
  - Database-level constraints proven by direct probe: negative amount rejected, REJECTED without reason rejected, duplicate voucher number rejected.
  - **Seed idempotency proven**: run three times, totals unchanged each run (`departments=6 categories=7 users=4 vouchers=5`). All three roles present (2 EMPLOYEE, 1 DIRECTOR, 1 ACCOUNTS). No seeded voucher has a password hash; all are DRAFT.
  - Collision-safe numbering confirmed: 25 concurrent `nextval()` allocations yielded 25 distinct values.
  - `npm test` (unit): **80 passed**. `npm run test:integration` (real PostgreSQL + Supertest): **33 passed, 0 skipped**.
  - `npm run typecheck` and `npm run build`: PASS. `npm run lint` (oxlint): 0 errors, 0 warnings.
  - Live endpoint verification: `/api/v1/health` 200 with real database round-trip (17 ms), `/health/live` 200, `/health/ready` 200, `/departments` and `/expense-categories` 200 with persisted rows, `/vouchers` and `/signatures/*` correctly 401, unknown route 404.
  - **Bug found and fixed by the suite**: `/health/ready` returned 500 instead of 503 when the database was unreachable. Root cause was forwarding the raw driver error; now mapped to a safe `DATABASE_UNAVAILABLE` 503.
  - Frontend regression: Phase 2 Playwright suite still green (21/21) and `npm run build` succeeds.
- **Current Status**: Completed (backend/data foundation only).
- **Not implemented in Phase 3** (deferred to Phases 4-7, by design): authentication and JWT sessions, role-based authorization enforcement, voucher create/edit/delete/submit, Director approve/reject, organization-wide search and analytics, signature upload/streaming, PDF export. All protected routes currently fail closed with HTTP 401 and are covered by tests.

---

### Phase 04: Secure Authentication, Sessions & Role-Based Authorization
- **Scope**: Build secure JWT-based authentication pipeline; bcrypt password hashing; HTTP-only sealed cookie session management; Express RBAC authorization middleware; frontend AuthContext and protected route guards.
- **Dependencies**: Phase 02, Phase 03.
- **Deliverables**:
  - Auth endpoints (`/api/v1/auth/login`, `/logout`, `/me`, `/logout-all`)
  - Auth middleware (`requireAuth`, `requireRole`, CSRF synchronizer token, rate limiters)
  - Cookie policy in shared `session-cookie.ts` (`HttpOnly`, `SameSite=Lax`, `Path=/`, production `__Host-` name, `Secure` in production)
  - Frontend `AuthProvider`, real login page, and role-based route guards (`RequireAuth`, `RedirectIfAuthenticated`)
  - Demo account provisioning script (`npm run auth:provision-demo`) with production guards
- **Acceptance Criteria**:
  - Valid credentials issue secure session cookie; JWT delivered only via HttpOnly cookie, never in a response body.
  - Passwords hashed with bcrypt (cost 12); never returned or logged.
  - JWT signature, HS256 algorithm, issuer, audience and expiry validated; sessions revocable server-side via `auth_sessions` rows.
  - CSRF synchronizer token protects cookie-authenticated unsafe requests; login origin checked against CORS allowlist.
  - Authentication middleware protects every relevant API endpoint; anonymous access returns 401 with stable envelope.
  - Role authorization enforced server-side: Employee ownership/IDOR scoped at query level, DRAFT-only edits (409 otherwise), Director-only approve/reject gate, Accounts organization-wide read-only.
  - Mass assignment and role escalation rejected (strict login schema strips unknown fields).
  - Private signature access (`GET /api/v1/signatures/:id`) enforces authentication, role and ownership; no public static route exists; storage keys and filesystem paths never leak.
  - Rate limiting active on login and baseline API.
  - Production cookie configuration verified by dedicated tests (`__Host-` prefix, no Domain, Secure, HttpOnly, expiry tied to `JWT_TTL_SECONDS`); development HTTP setup remains functional.
  - Demo role-switching authentication removed from frontend; role-protected routes use server-derived identity.
  - Frontend login, `/auth/me` session rehydration, logout, expiry/revocation redirect to login; protected content does not flash before the session resolves.
- **Verification Evidence (actual results)**:
  - Backend `npm run typecheck`: PASS (exit 0), including test files (strict settings retained; `token.split('.')` guarded with runtime assertions, no unsafe casts).
  - Backend `npm run lint` (oxlint): PASS, 0 errors, 0 warnings.
  - Backend `npm run test:all`: **247 passed, 0 failed, 0 skipped** (unit + integration against real PostgreSQL at `127.0.0.1:5433`; no hidden skips).
  - Backend `npm run build` (`prisma generate && tsc -p tsconfig.build.json`): PASS (exit 0).
  - Prisma: schema valid; `prisma migrate status` = "Database schema is up to date" (2 migrations: Phase 3 schema + additive `add_auth_sessions`); no destructive operations performed.
  - Signature access integration tests (`tests/integration/signatures.test.ts`, 14 tests): anonymous denied; Employee A can download own bytes; Employee A blocked from Employee B (IDOR); mutated signature id cannot bypass ownership; Director and Accounts organization-wide read allowed; missing backing file returns generic 500 with no path/storage-key leak; traversal storage key blocked (400); non-UUID rejected; no public static storage route; upload stays closed (501) behind auth+CSRF for Phase 5.
  - Production cookie tests (`tests/unit/production-cookie.test.ts`, 15 tests): real shared `session-cookie.ts` helpers exercised under production env injection — `__Host-pspl_session` name, HttpOnly, Secure, SameSite=Lax, Path=/, no Domain, expiry = `JWT_TTL_SECONDS`, clear uses same attributes; production startup guards refuse placeholder JWT secret and demo auth; development keeps unprefixed non-Secure cookie.
  - JWT/auth unit tests: tampered payload, foreign key, `none` algorithm, wrong issuer/audience, expired token, missing `sid` all rejected; tokens carry `iat`/`exp` = `JWT_TTL_SECONDS`.
  - Auth integration additions: expired token signed with the REAL secret rejected (401); wrong-issuer token signed with real secret rejected (401).
  - Logger redaction unit tests (`tests/unit/logger-redaction.test.ts`): cookies, authorization headers, passwords, hashes, tokens, secrets and full request bodies censored; ordinary diagnostic fields still logged. Redact path list extended to cover top-level `token`/`secret`/`csrfToken`/`jwt` fields (pino `*.x` wildcard is one level deep).
  - Demo provisioning: production execution rejected, explicit opt-in required, missing/weak passwords rejected, roles never changed, repeatable without duplicating users; provisioned demo accounts verified to carry bcrypt hashes.
  - Frontend `npx tsc -b`: PASS (exit 0).
  - Frontend `npm run lint` (oxlint): PASS, 0 errors, 5 `react(only-export-components)` advisories for the standard context-provider pattern.
  - Frontend `npm run build` (`tsc -b && vite build`): PASS (exit 0).
  - Targeted Playwright selection (`--project=edge --grep`, covering all previously failing auth/navigation tests): **13 passed, 0 failed, 0 skipped** (exit 0). Fixed defects: Account dashboard KPI assertions scoped to `#main-content` (strict-mode collision with sidebar link text); anonymous/expired-session redirect tests now mock `role: null` (previously mocked an authenticated role while expecting a login redirect) and assert rendered login state instead of fragile `waitForURL` navigation events.
  - Demo role switcher and `switchRole` bypass confirmed removed; user menu offers only logout.
  - `client/tests/e2e/_probe.spec.ts` (temporary diagnostic) confirmed and removed.
  - The FULL Playwright suite was NOT run in this pass (per execution rules); historical full-suite result remains 21 passed/10 failed, superseded for the affected tests by the targeted selection above.
  - Git: no `git add`/`commit`/`push` performed; `.env` files untracked; no database reset/drop/truncate.
- **Current Status**: Completed.
- **Not implemented in Phase 4** (deferred to Phases 5-6, by design): voucher create/edit/submit endpoints (still 501), Director approve/reject mutations (authorization gate reached, mutation 501), signature upload workflow (route exists closed at 501). Frontend screens continue to render curated demo data; they are now role-guarded by real server-derived identity but not yet wired to the full business-logic endpoints.

---

### Phase 05: Employee Portal, Voucher Creation & Complete Draft Lifecycle
- **Scope**: Employee dashboard with real-time KPI metrics; voucher creation form with Zod validation; Draft lifecycle actions (save draft, edit draft, delete draft); signature drawing pad and upload handler; formal submission workflow transitioning draft to Director queue.
- **Dependencies**: Phase 04.
- **Deliverables**:
  - Employee dashboard page (`/employee`)
  - Voucher creation and editing forms (`/employee/vouchers/new`, `/:id/edit`)
  - Digital signature pad component (`SignaturePad.tsx`)
  - Voucher submission endpoint (`POST /api/v1/vouchers/:id/submit`)
- **Acceptance Criteria**:
  - Employee can save drafts without a signature.
  - Employee cannot submit a voucher without a signature and all mandatory fields.
  - Once submitted, voucher becomes read-only for the employee.
  - Employee can delete their own draft vouchers.
- **Verification Evidence (actual results)**:
  - Backend workflow services (`createDraft`/`updateDraft`/`deleteDraft`/`submitDraft`) with conditional `updateMany` concurrency guards; submit emits `SUBMITTED` + `PENDING_APPROVAL` events in one transaction.
  - Signature upload: PNG/JPEG/WebP magic-byte detection, 5 MB limit, private vault storage (`LocalSignatureStorage`, sharded keys, path-traversal guarded).
  - Frontend: `MyVouchers` (server-side filters + pagination), `CreateVoucher`/`EditVoucher` (Zod-validated forms, department/category dropdowns from API), `SignaturePad` (canvas → Blob → upload), `VoucherDetail` (shared `VoucherDocument` + draft actions).
  - Backend suite at Phase 5/6 completion: **307 passed / 19 files**.
- **Current Status**: Completed.

---

### Phase 06: Director Approval Command Center & Decision Workflow
- **Scope**: Director dashboard with live decision metrics; approval queue with multi-filter search and pagination; review modal displaying full employee voucher dossier; Director signature upload and approval action; rejection workflow requiring mandatory explanation text.
- **Dependencies**: Phase 05.
- **Deliverables**:
  - Director dashboard (`/director`)
  - Approval queue data table (`/director/approvals`)
  - Review and approval modal with Director signature capture
  - Rejection drawer with mandatory reason validator
- **Acceptance Criteria**:
  - Director can view pending vouchers across all employees.
  - Approval requires Director signature and transitions status to `APPROVED`.
  - Rejection requires reason (>= 5 chars) and transitions status to `REJECTED`.
  - Approved/Rejected vouchers become permanently immutable.
- **Verification Evidence (actual results)**:
  - `approveVoucher`/`rejectVoucher`: conditional `updateMany({where:{status:'PENDING_APPROVAL'}})` — loser of a race gets 409 `INVALID_STATE_TRANSITION`; approve/reject both require a usable Director signature (422 otherwise); reject reason trimmed, 10–1000 chars.
  - APPROVED and REJECTED proven terminal across every mutating endpoint (re-approve, re-reject, submit, patch, delete, signature re-upload → 409) by the Phase 9 lifecycle suite.
  - Frontend: `DirectorDashboard` (KPIs + recent activity), `ApprovalQueue` (server-driven filters, search placeholder "Search number, title, employee..."), `VoucherReview` (shared document + signature pad + approve/reject controls, reason textarea ≥10 chars).
  - Director integration tests: **17 passed** (`director-workflow.test.ts`) including true-concurrency approve vs reject with exactly one winner.
- **Current Status**: Completed.

---

### Phase 07: Accounts Workspace, Organization-Wide Search & Live Analytics
- **Scope**: Accounts dashboard with reimbursement pipeline metrics; organization-wide read-only voucher register; comprehensive multi-column filter bar; detail drawer rendering employee and Director signatures; spending trend analytics charts.
- **Dependencies**: Phase 06.
- **Deliverables**:
  - Accounts dashboard (`/accounts`)
  - Organization voucher register (`/accounts/vouchers`)
  - Advanced search and query builder
  - Read-only audit drawer with dual-signature inspection
- **Acceptance Criteria**:
  - Accounts role can inspect all organization vouchers.
  - All create/edit/delete/approve/reject buttons are strictly absent.
  - Direct API mutation calls by Accounts role return HTTP 403.
- **Verification Evidence (actual results)**:
  - Shared Phase 7 query contract (`voucher-query.ts`): one Zod schema + `buildVoucherWhere`/`buildVoucherOrderBy` used by list, analytics, and dashboards; scope predicate always supplied by the authorization layer and ANDed — filters can never widen access.
  - Analytics service (`analytics.service.ts`): status distribution, expense trend (parameterized `Prisma.sql`, day|month granularity), category breakdown, accounts dashboard, activity feed.
  - New routes: `GET /vouchers/accounts/dashboard` (org-gated), `GET /vouchers/analytics/status|trends|categories` (scope-derived), `GET /vouchers/activity?limit=`.
  - Frontend: `AccountsDashboard` (real KPIs, recharts `AreaChart` with `data-testid="accounts-trend-chart"`, activity feed), `accounts/VoucherRegister` (server-side filters, read-only, links to `/accounts/vouchers/:id`), `accounts/VoucherDetail` (shared `VoucherDocument`, read-only signatures via `SignatureImage`).
  - `analytics-accounts.test.ts`: **31 tests** (role gating, Prisma-aggregate cross-checks, scope proofs, 400 rejections). Suite at Phase 7 completion: **338 passed / 20 files**.
- **Current Status**: Completed.

---

### Phase 08: Signature Experience, Document Export & Final Visual Excellence
- **Scope**: Hardened signature vault streaming endpoint with role validation; print stylesheet formatting clean, professional A4 voucher invoices; micro-interaction animations; responsive polish for mobile and desktop screens.
- **Dependencies**: Phase 07.
- **Deliverables**:
  - Protected signature streaming service (`GET /api/v1/signatures/:id`)
  - Printable voucher invoice view (`/vouchers/:id/print`)
  - Print CSS stylesheet
  - Micro-interaction polish across tables, cards, and modal dialogs
- **Acceptance Criteria**:
  - Signatures cannot be accessed without an active authenticated session.
  - Browser print command (`Ctrl + P`) renders a clean, unblemished financial document.
  - Zero layout overflow on mobile screens down to 375px.
- **Verification Evidence (actual results)**:
  - All 3 roles render detail through the single shared `VoucherDocument` (consistency criterion); Accounts sees read-only signatures via `SignatureImage` (authenticated fetch of `/api/v1/signatures/:id`).
  - Print: `VoucherDocument` includes a Print button (`data-testid="print-voucher"`) calling `window.print()`; `@media print` CSS in `src/index.css` hides app chrome and renders a clean A4 document.
  - Playwright E2E harness (`client/tests/e2e/mocks.ts`): `installApiMocks` intercepts every `/api/v1/*` endpoint solely via `page.route` (no app fallback code); bundled Chromium replaces the flaky Edge channel.
  - Print tests P1 (Employee) / P2 (Accounts) intercept `window.print` and click the print button; P3 asserts both signature `<img>` elements render with real bytes.
  - Overflow checks pass at 375/768/1440/2560 px.
- **Current Status**: Completed.

---

### Phase 09: Comprehensive Testing, Security Audit & End-to-End Bug Fixing
- **Scope**: Comprehensive test suite creation; Vitest unit tests for validators and state machine; Supertest API integration tests covering all routes and edge cases; Playwright end-to-end tests for all 3 user journeys; automated security audit.
- **Dependencies**: Phase 08.
- **Deliverables**:
  - Backend integration test suite (`tests/integration/*`)
  - Frontend component tests (`client/src/**/*.test.tsx`)
  - Playwright E2E journeys (`tests/e2e/*`)
  - Security audit and bug fix report
- **Acceptance Criteria**:
  - 100% test pass rate across all test suites.
  - Security tests verify cross-user isolation and post-submission immutability.
  - Zero high or critical vulnerability findings.
- **Verification Evidence (actual results)**:
  - **Backend: 355 passed / 21 files / 0 failed, 0 skipped** (Vitest 5.0.3 + Supertest against real PostgreSQL at `127.0.0.1:5433`).
  - New Phase 9 suite `lifecycle-journey.test.ts` (17 tests): full happy-path and reject-path journeys re-verified against the database (row state, event timeline order, dashboard aggregates, analytics counts); IDOR/authorization matrix (Employee A vs B, Director, Accounts across read/write/approve/reject/org endpoints); terminal-state invariants on APPROVED and REJECTED across every mutating endpoint; pagination/search/amount-filter responses cross-checked against Prisma counts; analytics status distribution equals per-status DB aggregates; activity feed scoped and newest-first.
  - `database.test.ts` updated for the Phase 9 seed contract: APPROVED vouchers carry reviewer + approvedAt, REJECTED carry reason + rejectedAt, decided vouchers have exactly EMPLOYEE + DIRECTOR signatures (CHECK constraints re-proven).
  - **Demo seed extended**: full lifecycle (5 DRAFT + 2 PENDING_APPROVAL + 2 APPROVED + 1 REJECTED), synthetic 1x1-PNG signatures written to the private vault with correct sha256/sizeBytes/storageKey, idempotent re-runs, `NODE_ENV=production` guard (exit 1).
  - **Playwright: 33 passed / 0 failed** in a single full run (bundled Chromium). Covers root/login, all 3 role dashboards/lists/details, nav, auth matrix 14a–14j, mobile drawer, widgets, overflow ×4 viewports, not-found, print P1/P2, signatures P3.
  - **Security/dependency audit: `npm audit` 0 vulnerabilities** (production AND dev) after: client already clean; server overrides `mysql2→^3.24.5` (Prisma CLI transitive, unused MySQL connector) and `deepmerge-ts→^8.0.2`; vitest upgraded 3.2.7→5.0.3 (fixes tinypool RCE + @vitest/mocker path traversal, dev-only). `prisma validate` and `migrate status` re-verified after overrides.
  - Typecheck/lint/build: server `tsc --noEmit` exit 0, `oxlint` 0 errors; client `tsc -b` exit 0, `oxlint` 0 errors (5 pre-existing context-provider warnings), `vite build` PASS.
  - Git hygiene: `git diff --check` exit 0; no `.env` tracked; `useDemoAuth.ts→.tsx` rename remains staged; no commit/push/reset performed.
- **Current Status**: Completed.

---

### Phase 10: Documentation, Deployment, Final Acceptance & Submission
- **Scope**: Production build verification; comprehensive root `README.md` with complete setup instructions, API reference, and database schema documentation; final environment templates; submission package verification.
- **Dependencies**: Phase 09.
- **Deliverables**:
  - Complete root `README.md` (33 numbered sections: overview, stack, architecture, setup, env vars, schema, state machine, API summary, auth, RBAC, vault, analytics, tests, demo, deployment, security, troubleshooting, limitations, docs index, traceability, phase history, license)
  - `docs/API.md` (full endpoint reference with envelopes and status-code conventions)
  - `docs/DEPLOYMENT.md` (production runbook + exact blocker prerequisites)
  - `docs/DEMO_GUIDE.md` (4-scene presenter script)
  - `docs/SECURITY.md` (threat model & controls)
  - `docs/FINAL_ACCEPTANCE_CHECKLIST.md` (32/32 functional reqs PASS; deployment BLOCKED)
  - `docs/screenshots/` (12 Playwright-captured UI screenshots)
  - `docker-compose.dev.yml` (PostgreSQL on `127.0.0.1:5433`)
  - `server/render.yaml` (hosting manifest, env var names only, no secrets)
  - `.env.example` files corrected to port 5433; credential-note files gitignored
- **Defects found and fixed during final review**:
  - `SignaturePad.tsx` (named Phase 5 deliverable) was missing — implementation used file upload only. Added a real canvas signature pad (pointer events, rasterize to PNG, identical upload pipeline) wired into the Employee create form and the Director review screen. All 33 E2E + 355 backend tests re-verified green after the change.
  - Stale `501 NOT_IMPLEMENTED` dead routes for `/approvals` and `/analytics` removed from `server/src/routes/index.ts` (analytics lives under `/vouchers/analytics/*`; approve/reject under `/vouchers/:id/*`). Stale "501 produced by the route" comment in `voucher-policy.service.ts` corrected.
  - Untracked local credential note file added to `.gitignore` (`login credentials to login.txt`, `*credentials*.txt`, `*.pem`, `*.key`).
- **Acceptance Criteria**:
  - Clean local clone-and-run verification.
  - Both frontend and backend compile with zero TypeScript errors.
  - Git repository is clean, inspectable, and ready for evaluation.
- **Verification Evidence (actual results, revalidated on final commit)**:
  - README rewritten from the stale Phase 1–4 version to a complete 33-section document using only real npm scripts and real ports.
  - Backend `npm run test:all`: **355 passed / 21 files / 0 failed** (real PostgreSQL `127.0.0.1:5433`).
  - Playwright `npm run test:e2e`: **33 passed / 0 failed** (bundled Chromium) — run after the SignaturePad wiring.
  - Screenshot capture (`playwright.screenshots.config.ts`, 12 screens): 12 passed; real PNGs (25–230 KB) in `docs/screenshots/`.
  - Typecheck/lint/build: server `tsc --noEmit` exit 0, `oxlint` exit 0, `npm run build` (prisma generate + tsc) exit 0; client `tsc -b` exit 0, `oxlint` exit 0 (no new warnings), `npm run build` (tsc + vite) exit 0.
  - `npm audit`: **0 vulnerabilities** (server and client, production and dev).
  - Secret scan (private keys, JWT-like tokens, AWS/GitHub keys, password/secret assignments) across tracked source/docs: 14 hits, all verified benign (validation strings, doc placeholders, e2e mock constant, deliberate redaction-test fixtures). No secret files tracked by git.
  - Deployment: manifest + runbook prepared; **BLOCKED** — no hosting account, managed database, persistent disk or TLS provisioned. No fake URLs published; exact prerequisites listed in `docs/DEPLOYMENT.md`.
  - Git: final commit `8da7b43` ("Phases 3-10: full-stack voucher system, tests, docs and acceptance", 143 files) pushed fast-forward to verified remote `https://github.com/shriramdani132004-svg/prachay-group-project.git`; `main` in sync with `origin/main`; working tree clean.
- **Current Status**: Completed (documentation, acceptance and publication done; live deployment documented as BLOCKED on infrastructure provisioning).
