# Institutional Fintech UI/UX Blueprint
## PSPL Expense Voucher Management System

---

## 1. Visual Identity & Design Philosophy

The **PSPL Expense Voucher Management System** is designed with the aesthetic polish, visual hierarchy, and functional density of institutional trading terminals and modern wealth-management SaaS platforms. It rejects cluttered generic enterprise dashboards in favor of:
- **Foundational Depth**: Deep navy and obsidian graphite surfaces (`#0B0F19`, `#111827`, `#1F2937`).
- **Precision Accents**: Electric violet (`#8B5CF6`) for primary interactions and cyan/teal (`#06B6D4` / `#10B981`) for positive financial validations.
- **Controlled Glassmorphism**: Translucent card surfaces with subtle backdrop blur (`backdrop-blur-md bg-slate-900/60 border border-slate-800/80`).
- **Data Density with Breathing Room**: Compact, high-information tables paired with generous whitespace around critical financial actions and status badges.
- **Instant Optical Feedback**: Micro-animations on hover, state changes, modal entries, and signature capture.

---

## 2. Design Tokens & Color Palette

### 2.1 Color Tokens
```css
/* Background & Neutral Foundation */
--color-bg-base:       #0A0E17;  /* Deepest slate void */
--color-bg-surface:    #111827;  /* Card and container surface */
--color-bg-elevated:   #1E293B;  /* Modals, popovers, tooltips */
--color-border-subtle: #1E293B;  /* Hairline dividers */
--color-border-focus:  #6366F1;  /* Focus ring & active boundaries */

/* Primary & Accent Spectrum */
--color-primary:       #6366F1;  /* Electric Indigo */
--color-primary-hover: #4F46E5;
--color-accent-cyan:   #06B6D4;  /* Institutional Cyan */
--color-accent-violet: #8B5CF6;  /* Electric Violet */

/* Semantic Financial Status Colors */
--color-draft:         #64748B;  /* Slate: Neutral draft state */
--color-submitted:     #3B82F6;  /* Sky Blue: Awaiting intake */
--color-pending:       #F59E0B;  /* Amber: Under director review */
--color-approved:      #10B981;  /* Emerald: Authorized & payable */
--color-rejected:      #EF4444;  /* Crimson: Blocked / rejected */
```

### 2.2 Typography Scale
- **Font Family**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `sans-serif`.
- **Monospace Font** (Numbers, IDs, Timestamps): `JetBrains Mono`, `Fira Code`, `ui-monospace`.
- **Scale**:
  - `Display / KPI`: `2.25rem` (36px), `font-bold`, `tracking-tight`
  - `H1 / Page Title`: `1.75rem` (28px), `font-semibold`
  - `H2 / Section Title`: `1.25rem` (20px), `font-medium`
  - `Body / Standard`: `0.875rem` (14px), `leading-relaxed`
  - `Caption / Subtext`: `0.75rem` (12px), `font-normal text-slate-400`
  - `Financial Figures`: Monospace tabular figures (`font-mono tabular-nums`).

---

## 3. Component Architecture & System Library

### 3.1 Button Hierarchy
1. **Primary Button** (`bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/20`): Used for critical actions (Submit for Approval, Sign & Approve).
2. **Secondary Button** (`bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700`): Used for auxiliary actions (Save as Draft, Cancel, Print).
3. **Danger Button** (`bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/30`): Used for Reject Voucher and Delete Draft.
4. **Ghost Button** (`hover:bg-slate-800 text-slate-400 hover:text-white`): Table row actions, icon toggles.

### 3.2 Status Badges
Badges feature an illuminated pulse indicator and high-contrast pill styling:
- **DRAFT**: `bg-slate-800/80 text-slate-300 border-slate-700`
- **SUBMITTED**: `bg-blue-950/80 text-blue-300 border-blue-800`
- **PENDING APPROVAL**: `bg-amber-950/80 text-amber-300 border-amber-800`
- **APPROVED**: `bg-emerald-950/80 text-emerald-300 border-emerald-800`
- **REJECTED**: `bg-rose-950/80 text-rose-300 border-rose-800`

### 3.3 Interactive Signature Pad & Canvas
- Dual interaction support:
  1. **Direct Digital Drawing**: Smooth HTML5 canvas with variable stroke-width interpolation for crisp digital signature input.
  2. **Image File Upload**: Drag-and-drop zone supporting `.png`, `.jpg`, and `.webp` with real-time thumbnail preview and dimensions check.
- Action triggers: Clear canvas, Undo stroke, Confirm signature.
- Visual display: Sealed inside a tamper-evident card border with cryptographic hash preview and upload timestamp.

---

## 4. Screen Layouts & User Experience

### 4.1 Authentication View (`/login`)
- **Layout**: Centered split card with deep ambient gradient glow (`radial-gradient(ellipse at top, #1e1b4b, #0a0e17)`).
- **Branding**: PSPL institutional logo, "Expense Voucher Portal", secure SSL indicator badge.
- **Controls**: Email field, password field with visibility toggle, demo role quick-select pill buttons for evaluator convenience.
- **Security Notice**: "Authorized Personnel Only. Session monitored and audited."

### 4.2 Application Shell & Navigation
- **Top Navigation Bar**:
  - Left: PSPL branding and current view breadcrumbs.
  - Center: Organization-wide global search trigger (`Ctrl + K`).
  - Right: Notification bell, current user badge (Name, Role pill: `EMPLOYEE` | `DIRECTOR` | `ACCOUNTS`), Logout button.
- **Sidebar (Collapsible)**:
  - Role-tailored navigation links with active state indicator glow.
  - Employee: Dashboard, My Vouchers, New Voucher (+), Expense Policies.
  - Director: Dashboard, Approval Queue (with pending count badge), History, Analytics.
  - Accounts: Dashboard, Voucher Register, Financial Reports, Audit Logs.

### 4.3 Employee Portal Screens

#### A. Employee Dashboard (`/employee`)
- **KPI Metrics Ribbon**:
  - `Total Vouchers`: Total count submitted across time.
  - `Draft Vouchers`: Count of editable drafts waiting for completion.
  - `Pending Approval`: Vouchers currently under Director review.
  - `Approved Vouchers`: Successfully approved claims.
  - `Rejected Vouchers`: Claims rejected by Director (read-only; rejection reason displayed).
  - `Total Amount Claimed`: Total currency value claimed to date.
- **Recent Vouchers Table**: Fast overview with inline status pills, dates, amounts, and Quick Action buttons.
- **Primary CTA**: Prominent "+ Create New Voucher" button.

#### B. Voucher Creation & Draft Form (`/employee/vouchers/new` & `/:id/edit`)
- **Structure**: 2-Column responsive form with real-time summary card.
- **Fields**:
  - Expense Date (Date picker with max constraint <= today).
  - Department (Select — proposed examples: Equity Trading, Investment Banking, Compliance, Operations, IT, Research; final list configurable via seed data).
  - Expense Title (Text input, max 100 chars).
  - Expense Category (Select — proposed examples: Travel, Client Entertainment, Office Supplies, Software, Utilities, Miscellaneous; final list configurable via seed data).
  - Expense Description (Rich textarea for itemized context).
  - Claim Amount (Monospace currency input with INR `₹` prefix, validation > 0.00).
- **Signature Section**: Mandatory employee signature pad / file upload.
- **Actions**:
  - `Save as Draft`: Saves changes, allows employee to return later.
  - `Submit for Approval`: Validates completeness, transitions voucher to Director queue.
  - `Delete Draft`: Permanently removes draft record.

#### C. Voucher Detail View (`/employee/vouchers/:id`)
- Complete financial voucher ledger layout.
- If status is `REJECTED`: Prominent high-contrast crimson banner displaying the Director's explicit rejection rationale.
- Interactive lifecycle timeline step indicator:
  `Created (Draft) -> Submitted -> Pending Approval -> Approved / Rejected`.

### 4.4 Director Command Center Screens

#### A. Director Dashboard (`/director`)
- **Financial Risk KPIs**:
  - `Pending Approvals`: Large attention indicator.
  - `Approved Today`: Count of vouchers signed off today.
  - `Rejected Today`: Count of vouchers declined today.
  - `Total Pending Exposure`: Sum of all rupees currently awaiting approval.
- **Urgent Action Queue**: Interactive list of oldest pending vouchers requiring sign-off.

#### B. Approval Queue (`/director/approvals`)
- **Advanced Filtering Bar**:
  - Search input (instant query on employee name, title, voucher #).
  - Department filter pill dropdowns.
  - Category selector.
  - Amount range sliders.
- **Review Modal & Workflow**:
  - Modal pops up with complete voucher dossier (dates, line items, employee signature).
  - Employee inputs are strictly read-only.
  - **Action: Approve**: Triggers Director Signature drawing pad / file selector -> Authorizes voucher with timestamp.
  - **Action: Reject**: Opens rejection drawer requiring mandatory explanation (min 5 characters) -> Rejects voucher and alerts employee.

### 4.5 Accounts Workspace Screens

#### A. Accounts Dashboard (`/accounts`)
- **Reimbursement Pipeline KPIs**:
  - `Total Vouchers`: Complete organization voucher volume.
  - `Pending Approval`: In-flight claims.
  - `Approved Vouchers`: Payable items awaiting disbursement.
  - `Rejected Vouchers`: Audited rejections.
  - `Total Approved Amount`: Cumulative authorized funds for accounting.
- **Monthly Spending Trends Chart**: Visual area chart showing approved amounts by department.

#### B. Organization Voucher Register (`/accounts/vouchers`)
- Full read-only financial ledger.
- Multi-column sortable table (Voucher No, Employee, Dept, Date, Category, Amount, Status).
- Detail Drawer: Full verification view showing employee signature and Director authorization signature side-by-side.
- Print / Export Action: Formats an official invoice view formatted for hardcopy accounting archives.

---

## 5. Micro-Interactions, Motion & Accessibility

### 5.1 Motion Principles
- **Page Transitions**: Subtle 150ms opacity fade and 4px upward translation.
- **Modal / Drawer Dialogs**: Smooth scale in (`scale: 0.98 -> 1.0`, `duration: 0.2s`).
- **Button Feedback**: Gentle scale click effect (`active:scale-95`).
- **Reduced Motion Support**: All animations wrapped in `@media (prefers-reduced-motion: reduce)` to disable non-essential motion.

### 5.2 Accessibility Standards (WCAG 2.1 AA)
- Contrast ratio between text and surface backgrounds exceeds 4.5:1 across all themes.
- Clear visual `:focus-visible` styling (`outline-2 outline-indigo-500 outline-offset-2`).
- Screen reader accessibility using ARIA landmarks: `role="status"`, `aria-live="polite"` for toast messages, `aria-describedby` for form validation errors.
- Fully operable via keyboard (tab navigation through tables, ESC to close modals, Enter to confirm).
