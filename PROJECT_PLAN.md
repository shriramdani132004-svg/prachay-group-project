# Master Project Plan & Execution Blueprint
## Expense Voucher Management System - Prachay Securities Private Limited (PSPL)

---

## 1. Project Overview & Objectives

### 1.1 Context & Purpose
Prachay Securities Private Limited (PSPL) requires an enterprise-grade **Expense Voucher Management System** to replace manual and ad-hoc expense reimbursement workflows with a streamlined, secure, role-governed digital system. The platform will serve three distinct internal personas:
1. **Employees**, who author, sign, and submit business expense claims.
2. **Directors**, who review claims with organizational oversight, enforce fiduciary policy, inspect line items, and authorize with a legal digital signature or reject with mandatory justification.
3. **Accounts Team**, who perform read-only audit oversight, inspect approved amounts and signature artifacts, and manage the reimbursement execution queue.

### 1.2 Core Success Metrics
- **Zero Cross-User Data Leakage**: Complete isolation between employee submissions.
- **Strict Immutability**: Submitted and approved vouchers cannot be edited, tampered with, or bypassed.
- **Audit-Ready Financial Integrity**: Collision-safe sequential voucher IDs, immutable timestamps, and transaction-backed state transitions.
- **Fintech UI/UX Polish**: A high-density, accessible, dark-themed command center reflecting the visual and ergonomic standards of institutional trading platforms.

---

## 2. Assignment Constraints & Verification Limitations

- **Assignment PDF Verification**: The assignment PDF (`Full Stack Developer Internship Assignment PSPL.pdf`) is explicitly excluded by `.gitignore` and is not stored in the repository. All specifications in this project blueprint are strictly derived from the client requirements provided in the project mandate.
- **Safety & Version Control**: No automated destructive commands (`git reset --hard`, `git clean -fd`, force pushes) or unauthorized commits may be executed during planning phases.
- **Production Readiness**: Code written in subsequent phases must use real PostgreSQL schemas, real JWT authentication, real database-backed aggregations, and real signature uploads—never mock-only stubs.

---

## 3. User Roles & Permission Matrix

| Role | Voucher Creation | Voucher Modification | Voucher Deletion | Voucher Submission | Approval / Rejection | Organization-Wide Search | Signature Upload |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Employee** | [x] Yes (Draft) | [x] Yes (Draft only) | [x] Yes (Draft only) | [x] Yes (Own Draft) | [ ] No | [ ] No (Own only) | [x] Yes (Employee signature) |
| **Director** | [ ] No | [ ] No (Immutable) | [ ] No | [ ] No | [x] Yes (Pending vouchers) | [x] Yes | [x] Yes (Director approval sig) |
| **Accounts** | [ ] No | [ ] No (Read-Only) | [ ] No | [ ] No | [ ] No | [x] Yes | [ ] No (Read-only viewing) |

---

## 4. Functional Requirements Checklist

### 4.1 Employee Capabilities
- [ ] Secure authentication with credentials and role assignment.
- [ ] Real-time dashboard with KPIs: Total Vouchers, Draft Vouchers, Pending Approval, Approved Vouchers, Rejected Vouchers, Total Amount Claimed.
- [ ] Create expense voucher starting in `DRAFT` status.
- [ ] Input fields: Expense Date, Department, Expense Title, Expense Category, Description, Amount.
- [ ] Edit existing vouchers while in `DRAFT` status.
- [ ] Delete existing vouchers while in `DRAFT` status.
- [ ] Upload personal employee signature image (PNG/JPEG/WEBP).
- [ ] Validate all required fields and verify employee signature existence prior to submission.
- [ ] Submit voucher to transition from `DRAFT` to `SUBMITTED` / `PENDING_APPROVAL`.
- [ ] View list of own vouchers with status badges and creation dates.
- [ ] Open comprehensive voucher detail modal/page.
- [ ] View rejection reason prominently if voucher was rejected by Director.
- [ ] Strict backend isolation preventing viewing or modifying other employees' vouchers.

### 4.2 Director Capabilities
- [ ] Secure authentication with Director credentials.
- [ ] Real-time dashboard with KPIs: Pending Approval Count, Approved Today, Rejected Today, Total Pending Amount, Recent Activity Feed.
- [ ] Organization-wide voucher list with multi-column sorting and pagination.
- [ ] Filter vouchers by Department, Category, Status, Date Range, and Amount Range.
- [ ] Search vouchers by Voucher Number, Employee Name, and Title.
- [ ] Detailed review view displaying all employee-submitted information in read-only format.
- [ ] Inspection of employee signature image.
- [ ] One-click or modal-guided Approval requiring Director digital signature image upload.
- [ ] Guided Rejection flow requiring a mandatory rejection reason (minimum character limit enforced).
- [ ] Immutability guard ensuring employee inputs cannot be altered during review.

### 4.3 Accounts Team Capabilities
- [ ] Secure authentication with Accounts credentials.
- [ ] Real-time dashboard with KPIs: Total Vouchers, Pending Approval, Approved Vouchers, Rejected Vouchers, Total Approved Expense Amount, Recent Approved Vouchers.
- [ ] Organization-wide read-only voucher register with multi-faceted filters.
- [ ] Full voucher inspection: line items, amounts, approval timestamps, employee signature, and Director signature.
- [ ] Export and print voucher views formatted for finance records and reimbursement processing.
- [ ] Strict enforcement preventing creation, modification, deletion, approval, or rejection actions.

---

## 5. Non-Functional Requirements

- **Security**:
  - Passwords hashed using `bcrypt` (work factor 12) or `argon2id`.
  - JWT tokens sealed in `httpOnly`, `SameSite=Lax`, `Secure` cookies.
  - Server-side role enforcement on every route; no security-by-obscurity.
  - Rate limiting on authentication and signature upload endpoints.
  - Magic-byte validation on image uploads to prevent malicious file execution.
- **Performance**:
  - API response times under 150ms for indexed read queries.
  - Sub-second aggregations leveraging database-level indexes and aggregate functions.
  - Lightweight frontend bundle (<350kB gzipped initial chunk).
- **Usability & Accessibility**:
  - Dark fintech aesthetic with WCAG AA compliance (4.5:1 contrast for text).
  - Clear visual focus outlines for keyboard navigation.
  - Responsive layout functional from 375px mobile screens to 4K ultra-wide monitors.
  - Screen-reader friendly semantic HTML tags and ARIA labels.
- **Reliability & Auditability**:
  - Atomic database transactions for state transitions.
  - Dedicated `AuditLog` table capturing actor, action, timestamp, and IP address for all lifecycle events.

---

## 6. Voucher Lifecycle & Business Rules

```
+---------+         submit()          +-------------+  auto-advance   +--------------------+
|  DRAFT  | ------------------------> |  SUBMITTED  | --------------> |  PENDING_APPROVAL  |
+---------+  (sig & fields validated) +-------------+                 +--------------------+
     |                                                                           |
     | (delete)                                                   +--------------+--------------+
     v                                                            |                             |
 [DELETED]                                                        v (approve + dir sig)         v (reject + reason)
                                                            +------------+                +------------+
                                                            |  APPROVED  |                |  REJECTED  |
                                                            +------------+                +------------+
                                                            (Immutable)                   (Immutable)
```

### Business Rules Summary:
1. Voucher number format: `VCH-YYYYMMDD-XXXX` (auto-generated, collision-safe).
2. Minimum voucher amount: > 0.00.
3. Employee signature is mandatory prior to submission.
4. Director signature is mandatory upon approval.
5. Rejection reason is mandatory upon rejection (min 5 characters).
6. Draft vouchers are the only editable/deletable entities.
7. Submitted, approved, and rejected vouchers are immutable.

---

## 7. Search & Filtering Specifications

The voucher search query builder supports combinable parameters:
- `search`: Full-text/ILIKE matching on `voucherNumber`, `expenseTitle`, and `employee.fullName`.
- `department`: Filter by department (e.g., Equity Trading, Investment Banking, Compliance, Operations, IT).
- `category`: Filter by category (e.g., Travel, Meals, Office Supplies, Client Entertainment, Subscriptions, Utilities, Miscellaneous).
- `status`: Filter by status (`DRAFT`, `SUBMITTED`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`).
- `dateFrom` & `dateTo`: Filter by expense date range.
- `minAmount` & `maxAmount`: Filter by financial value.
- `sortBy` & `sortOrder`: Multi-column sorting (`expenseDate`, `amount`, `voucherNumber`, `createdAt`, `asc`/`desc`).
- `page` & `limit`: Standardized pagination with total count and page metadata.

---

## 8. Technology Stack & Rationale

| Layer | Selected Technology | Alternative Evaluated | Decision Rationale |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React 18 + Vite + TypeScript | Next.js / Create React App | Vite delivers instant HMR and clean SPA builds without SSR overhead for an internal authenticated portal. |
| **Styling & Icons** | Tailwind CSS + Lucide Icons | MUI / Ant Design | Custom institutional fintech dark aesthetic, zero runtime CSS overhead, accessible layout primitives. |
| **Animations** | Framer Motion | CSS transitions only | Smooth state transitions, expandable accordion queues, and subtle entrance micro-interactions. |
| **Data Visualizations** | Recharts | Chart.js | Native React declarative SVG rendering, responsive containers, and dark theme support. |
| **Backend Framework** | Node.js + Express + TypeScript | NestJS | Express offers lightweight, transparent middleware layering with complete type safety and minimal boilerplate. |
| **ORM & Database** | Prisma ORM + PostgreSQL | TypeORM / MySQL | Type-safe query builder, automated migration tracking, robust relation handling, and ACID transactions. |
| **File Handling** | Multer + Protected Local Vault | Public Cloud Bucket | Ensures legal signatures are never accessible via unauthenticated public URLs; access is verified per request. |
| **Testing Suite** | Vitest + Supertest + Playwright | Jest + Cypress | Fast ESM execution, seamless integration with Vite, and cross-browser E2E capabilities. |

---

## 9. Master Ten-Phase Development Roadmap

### Phase 1: Repository Audit, Requirements Analysis and Architecture Blueprint [CURRENT]
- **Scope**: Repository audit, requirements formalization, technology stack definition, state machine modeling, and architecture authoring.
- **Outputs**: `PROJECT_PLAN.md`, `ARCHITECTURE.md`, `REQUIREMENTS_TRACEABILITY.md`, `UI_UX_BLUEPRINT.md`, `PHASE_TRACKER.md`.
- **Status**: In Progress.
- **Criteria**: Complete documentation set authored, consistent across all files, zero unverified assumptions.

### Phase 2: Premium Fintech Design System and Flashy Application Shell
- **Scope**: Initialize frontend Vite React TypeScript project, configure Tailwind CSS design tokens, build reusable component library (Buttons, Cards, Inputs, Modals, Status Badges, Data Tables, Toast notifications), implement layout shells (Navbar, Sidebar, PageHeader) with dark glassmorphism and motion.
- **Dependencies**: Phase 1 architectural blueprint.
- **Criteria**: Responsive shell rendered with role switcher/preview, accessible typography, color tokens verified.

### Phase 3: Database, Backend Architecture and API Foundation
- **Scope**: Initialize backend Express TypeScript server, configure Prisma with PostgreSQL schema, write migrations, seed script with 3 default roles, implement centralized error handler, logger, and health check.
- **Dependencies**: Phase 1 schema specifications.
- **Criteria**: Database migrations run cleanly, seed script creates valid users and test vouchers, server starts on port 5000.

### Phase 4: Secure Authentication, Sessions and Role-Based Authorization
- **Scope**: Implement JWT cookie authentication (`/login`, `/logout`, `/me`), password hashing with bcrypt, RBAC middleware (`requireRole('EMPLOYEE')`, etc.), route guards on frontend.
- **Dependencies**: Phase 2 components, Phase 3 backend foundation.
- **Criteria**: Users can log in as Employee, Director, or Accounts; unauthorized endpoints return 401/403; sessions persist safely.

### Phase 5: Employee Portal, Voucher Creation and Complete Draft Lifecycle
- **Scope**: Build Employee dashboard with real-time KPI metrics, voucher creation form with validation, Draft save/edit/delete actions, digital signature capture pad/upload, and voucher submission workflow.
- **Dependencies**: Phase 4 authentication.
- **Criteria**: Employee can create Draft, edit Draft, delete Draft, sign and submit; submitted voucher becomes read-only and appears in Director queue.

### Phase 6: Director Approval Command Center and Decision Workflow
- **Scope**: Build Director dashboard with live metrics, approval queue with search and filters, review modal with signature inspection, approval action with Director signature capture, and rejection modal with mandatory reason.
- **Dependencies**: Phase 5 voucher submissions.
- **Criteria**: Director can inspect vouchers, approve with signature, or reject with reason; state transitions reflect instantly across DB and UI.

### Phase 7: Accounts Workspace, Organization-Wide Search and Live Analytics
- **Scope**: Build Accounts dashboard with financial metrics, organization-wide read-only voucher register, multi-column filters and sorting, detailed audit inspection, and aggregate expense charts.
- **Dependencies**: Phase 6 approved vouchers.
- **Criteria**: Accounts can search and filter all organization vouchers, view signatures and approved amounts; creation/approval buttons are absent.

### Phase 8: Signature Experience, Document Export and Final Visual Excellence
- **Scope**: Formalize protected signature vault streaming, build printable/exportable voucher invoice layout (clean print stylesheet), fine-tune fintech animations, micro-interactions, responsive polish.
- **Dependencies**: Phase 7 completed workflows.
- **Criteria**: Signature images render reliably across roles; print view formats perfectly on A4 paper; UI animations smooth at 60 FPS.

### Phase 9: Comprehensive Testing, Security Audit and End-to-End Bug Fixing
- **Scope**: Write backend integration tests with Supertest (auth, voucher CRUD, state transitions, unauthorized access), frontend component tests with Vitest, and end-to-end user journey tests with Playwright.
- **Dependencies**: Phases 2–8 full-stack implementation.
- **Criteria**: All test suites pass cleanly; security checks confirm zero cross-tenant data leakage.

### Phase 10: Documentation, Deployment, Final Acceptance and Submission
- **Scope**: Complete root `README.md` with detailed setup instructions, database schema explanation, API documentation, `.env.example`, demo seed data, deployment verification, final code inspection.
- **Dependencies**: Phase 9 passing verification.
- **Criteria**: Clean Git status, complete documentation, verified build scripts (`npm run build`), ready for evaluation.

---

## 10. Risk Assessment & Mitigation Plan

| Identified Risk | Severity | Mitigation Strategy |
| :--- | :---: | :--- |
| **Concurrent Voucher Number Collision** | Medium | Utilize database-level sequence or retry loop with unique constraint on `voucherNumber`. |
| **Cross-Tenant Voucher Tampering** | High | Every voucher mutation endpoint verifies `voucher.createdById === req.user.id` on backend. |
| **Unprotected Signature Asset Leakage** | High | Signature files are stored in a private directory and streamed through authenticated, role-gated endpoints. |
| **Post-Submission Modification Exploit** | High | Database updates check `status === 'DRAFT'`; any update attempted on other statuses is rejected with 400. |
| **Orphaned Drafts or Abandoned Uploads** | Low | Automated cleanup or soft-validation ensuring unreferenced signatures are purged during seed/maintenance. |
