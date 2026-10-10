# Requirements Traceability Matrix (RTM)
## PSPL Expense Voucher Management System

---

## 1. Traceability Matrix Overview

This matrix maps every functional, security, data integrity, and interface requirement from the PSPL assignment to its respective architectural components, database entities, verification methods, planned development phases, and current delivery status.

### Status Legend
- **Planned (Not Started)**: Architectural specification completed in Phase 1; implementation scheduled for designated phase.
- **In Progress**: Actively being implemented or tested in current phase.
- **Completed**: Fully implemented, verified with tests, and accepted.

---

## 2. Comprehensive Requirements Matrix

| Req ID | Requirement Description | Role | Category | Planned Screen / Interface | Planned API / Service | DB Entity & Constraints | Planned Verification Method | Phase | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **REQ-AUTH-01** | Secure login with role determination | All | Mandatory | `/login` (LoginPage) | `POST /api/v1/auth/login` | `User.email`, `passwordHash`, `role` | Integration test: valid/invalid creds | Phase 4 | Planned |
| **REQ-AUTH-02** | Session persistence & secure logout | All | Mandatory | Global App Header | `POST /api/v1/auth/logout`, `GET /api/v1/auth/me` | HTTP-only cookie, token expiry check | E2E test: session lifecycle | Phase 4 | Planned |
| **REQ-AUTH-03** | Server-side role-based authorization guards | All | Mandatory | Route Guard HOC / Router | `requireRole(...)` Express middleware | `User.role` enum check | API integration test: 403 Forbidden | Phase 4 | Planned |
| **REQ-EMP-01** | Employee real-time dashboard KPIs | Employee | Mandatory | `/employee` (EmployeeDashboard) | `GET /api/v1/analytics/dashboard` | `Voucher` count & sum aggregates | Unit test aggregate query & UI render | Phase 5 | Planned |
| **REQ-EMP-02** | Create new voucher in Draft status | Employee | Mandatory | `/employee/vouchers/new` (VoucherForm) | `POST /api/v1/vouchers` | `Voucher.status = 'DRAFT'` | Integration test: create draft record | Phase 5 | Planned |
| **REQ-EMP-03** | Auto-generate unique voucher number | System | Mandatory | Voucher detail & receipt | `VoucherNumberGenerator` service | `Voucher.voucherNumber` UNIQUE constraint | Unit test collision safety & format | Phase 3 | Planned |
| **REQ-EMP-04** | Edit Draft voucher | Employee | Mandatory | `/employee/vouchers/:id/edit` | `PUT /api/v1/vouchers/:id` | Status check `status == DRAFT`, owner check | Integration test: edit draft vs submitted | Phase 5 | Planned |
| **REQ-EMP-05** | Delete Draft voucher | Employee | Mandatory | `/employee/vouchers` (VoucherTable) | `DELETE /api/v1/vouchers/:id` | Status check `status == DRAFT`, owner check | Integration test: delete draft vs submitted | Phase 5 | Planned |
| **REQ-EMP-06** | Upload employee signature image | Employee | Mandatory | `SignaturePad` / Upload component | `POST /api/v1/signatures/upload` | File validation, `employeeSignatureUrl` | Test MIME type & magic byte validation | Phase 5 | Planned |
| **REQ-EMP-07** | Submit voucher for Director approval | Employee | Mandatory | Voucher Detail / Form submission | `POST /api/v1/vouchers/:id/submit` | Status -> `SUBMITTED`/`PENDING_APPROVAL` | State machine integration test | Phase 5 | Planned |
| **REQ-EMP-08** | Enforce submission validation rules | System | Mandatory | Client form & API validator | `validateSubmitVoucher` (Zod) | Amount > 0, required fields, sig exists | API test: rejected if missing sig/fields | Phase 5 | Planned |
| **REQ-EMP-09** | Restrict employee view to own vouchers | Employee | Mandatory | `/employee/vouchers` list | `GET /api/v1/vouchers` (`where createdById = req.user.id`) | Tenant isolation via `createdById` | Integration test: employee cannot see other | Phase 5 | Planned |
| **REQ-EMP-10** | View full voucher details & timeline | Employee | Mandatory | `/employee/vouchers/:id` (VoucherDetail) | `GET /api/v1/vouchers/:id` | Complete record with `AuditLog` | Component test: timeline render | Phase 5 | Planned |
| **REQ-EMP-11** | View rejection reason on rejected voucher | Employee | Mandatory | Voucher Detail / Banner | `GET /api/v1/vouchers/:id` | `Voucher.rejectionReason` NOT NULL on reject | UI test: banner displays reason text | Phase 5 | Planned |
| **REQ-DIR-01** | Director real-time dashboard KPIs | Director | Mandatory | `/director` (DirectorDashboard) | `GET /api/v1/analytics/dashboard` | Org-wide aggregates: pending, approved today | Integration test aggregate calculation | Phase 6 | Planned |
| **REQ-DIR-02** | View organization-wide pending queue | Director | Mandatory | `/director/approvals` (ApprovalQueue) | `GET /api/v1/vouchers?status=PENDING_APPROVAL` | Status filter across all users | Integration test: returns org-wide records | Phase 6 | Planned |
| **REQ-DIR-03** | Search, filter, sort & paginate vouchers | Director | Mandatory | `/director/approvals` (DataTable) | `GET /api/v1/vouchers?...query` | SQL query with filters & pagination | API test: combined filter evaluation | Phase 6 | Planned |
| **REQ-DIR-04** | Inspect full voucher details (read-only) | Director | Mandatory | `/director/vouchers/:id/review` | `GET /api/v1/vouchers/:id` | Read-only render of employee data | UI test: form fields uneditable | Phase 6 | Planned |
| **REQ-DIR-05** | Approve voucher with Director signature | Director | Mandatory | Review modal / Approval dialog | `POST /api/v1/approvals/:id/approve` | `status = APPROVED`, `directorSignatureUrl` | State transition test with signature | Phase 6 | Planned |
| **REQ-DIR-06** | Reject voucher with mandatory reason | Director | Mandatory | Rejection dialog modal | `POST /api/v1/approvals/:id/reject` | `status = REJECTED`, `rejectionReason` req | API test: 400 if reason empty | Phase 6 | Planned |
| **REQ-DIR-07** | Director cannot edit employee inputs | Director | Mandatory | Review interface | No edit route for Director role | Immutability check in service layer | Security test: PUT /vouchers 403 for Director| Phase 6 | Planned |
| **REQ-ACC-01** | Accounts real-time dashboard KPIs | Accounts | Mandatory | `/accounts` (AccountsDashboard) | `GET /api/v1/analytics/dashboard` | Org-wide financial totals & approved count | Integration test accounts aggregate | Phase 7 | Planned |
| **REQ-ACC-02** | View organization-wide voucher register | Accounts | Mandatory | `/accounts/vouchers` (VoucherRegister) | `GET /api/v1/vouchers` | Read-only access to all vouchers | API test: returns all employee vouchers | Phase 7 | Planned |
| **REQ-ACC-03** | Search, filter & sort voucher register | Accounts | Mandatory | `/accounts/vouchers` (DataTable) | `GET /api/v1/vouchers?...query` | SQL filtering on dept, category, amount | UI & API search test | Phase 7 | Planned |
| **REQ-ACC-04** | Inspect voucher, amounts & both signatures | Accounts | Mandatory | `/accounts/vouchers/:id` (VoucherInspect) | `GET /api/v1/vouchers/:id` | Employee & Director signature URLs | E2E test: signature verification | Phase 7 | Planned |
| **REQ-ACC-05** | Accounts mutation lockdown (Read-Only) | Accounts | Mandatory | Entire Accounts interface | Express RBAC prevents all mutations | No POST/PUT/DELETE voucher endpoints allowed | Security test: 403 on all mutations | Phase 7 | Planned |
| **REQ-ACC-06** | Export / Print formatted voucher receipt | Accounts / All | Bonus | Voucher Detail Print View | Client print CSS / PDF export | Formatted printable invoice template | Visual regression test & print preview | Phase 8 | Planned |
| **REQ-SEC-01** | Protected signature vault access | System | Mandatory | Signature streaming component | `GET /api/v1/signatures/:id` | Access validation before file streaming | Security test: unauthenticated access 401/403 | Phase 8 | Planned |
| **REQ-SEC-02** | Post-submission & post-approval immutability | System | Mandatory | Service layer | Database update guards | Voucher update restricted to DRAFT | Unit/Integration test: mutation blocked | Phase 3 | Planned |
| **REQ-DEV-01** | Repeatable database seed script | System | Mandatory | CLI `npx prisma db seed` | Prisma seed script | Demo accounts for 3 roles & mock vouchers | CLI execution test in development | Phase 3 | Planned |
| **REQ-DEV-02** | Standardized `.env.example` template | System | Mandatory | Root repository | Environment config | Clean configuration with documentation | Verification check for secret exposure | Phase 1 | Completed |
| **REQ-DEV-03** | Comprehensive documentation suite | System | Mandatory | Root repository | Markdown docs | Complete guides for setup, architecture | Phase 1 & 10 documentation audits | Phase 1 | In Progress |

---

## 3. Verification & Acceptance Traceability

| Phase | Milestone Name | Total Traceable Reqs | Primary Test Tool | Verification Deliverable |
| :---: | :--- | :---: | :--- | :--- |
| **Phase 1** | Repository Audit & Architecture Blueprint | 3 | File audit, Linters | `PROJECT_PLAN.md`, `ARCHITECTURE.md`, `RTM.md` |
| **Phase 2** | Design System & Application Shell | 4 | Vitest, Storybook/Vite | Component tests & UI render verification |
| **Phase 3** | Database, Backend & API Foundation | 5 | Vitest, Prisma Studio | Schema migrations & seed script verification |
| **Phase 4** | Authentication, Sessions & RBAC | 3 | Supertest | Auth token & RBAC isolation tests |
| **Phase 5** | Employee Portal & Draft Lifecycle | 6 | Supertest, Playwright | Employee workflow end-to-end tests |
| **Phase 6** | Director Approval Command Center | 5 | Supertest, Playwright | Approval & rejection workflow tests |
| **Phase 7** | Accounts Workspace & Analytics | 4 | Supertest, Playwright | Read-only register & aggregate tests |
| **Phase 8** | Signature Vault & Export Excellence | 2 | Playwright, Visual check | Signature streaming & print layout tests |
| **Phase 9** | Comprehensive Testing & Security Audit | All | Vitest, Supertest, Playwright | Full test suite report & security audit log |
| **Phase 10** | Final Deployment, Docs & Submission | All | Build scripts, E2E run | Final README, working deployment package |
