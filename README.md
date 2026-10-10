# Prachay Group Project

Expense Voucher Management System for Prachay Securities Private Limited (PSPL).

## Project Status

**Phase 1**: ✅ Completed - Repository Audit, Requirements Analysis & Architecture Blueprint
**Phase 2**: ✅ Completed - Premium Fintech Design System & Flashy Application Shell

## Technology Stack

### Frontend (Phase 2)
- **React 19** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling with custom fintech design tokens
- **React Router** for client-side routing
- **Lucide React** for icons
- **Framer Motion** for animations
- **Recharts** for data visualizations
- **React Hook Form** with **Zod** for form validation
- **TanStack Query** for server state management
- **Zustand** for client state management

### Backend (Planned - Phase 3+)
- **Node.js** with Express and TypeScript
- **Prisma ORM** with PostgreSQL
- **JWT** authentication with HTTP-only cookies

## Getting Started

### Prerequisites
- Node.js 18+ (tested with Node 24.12.0)
- npm 9+ (tested with npm 11.6.2)

### Frontend Development

```bash
cd client
npm install
npm run dev
```

The development server will start at `http://localhost:5173`

### Available Scripts (Frontend)

```bash
cd client
npm run dev       # Start development server
npm run build     # Build for production
npm run lint      # Run linter (oxlint)
npm run preview   # Preview production build
```

## Demo Access

The application includes a **Demo Preview Mode** on the login page that allows you to explore the interface as different roles:

- **Employee** - Create and submit vouchers
- **Director** - Approve/reject vouchers with signature
- **Accounts** - View organization-wide voucher register

> **Note**: This is a frontend-only demo. No backend is connected in Phase 2. All data is fictional and not persisted.

## Project Structure

```
prachay-group-project/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── app/           # App-level setup (router, providers)
│   │   ├── components/    # Reusable UI components
│   │   │   ├── common/    # Buttons, Cards, Badges, etc.
│   │   │   ├── forms/     # Input, Select, Textarea, etc.
│   │   │   ├── data-display/ # Tables, KPI Cards
│   │   │   ├── feedback/  # Toast, Skeleton, EmptyState
│   │   │   ├── overlays/  # Modal, Dropdown
│   │   │   ├── layout/    # Shell, Sidebar, TopNav
│   │   │   └── charts/    # Chart components
│   │   ├── features/      # Feature-specific pages
│   │   │   ├── auth/      # Login page
│   │   │   ├── employee/  # Employee screens
│   │   │   ├── director/  # Director screens
│   │   │   └── accounts/  # Accounts screens
│   │   ├── data/          # Demo data
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utilities
│   │   └── types/         # TypeScript types
│   └── public/            # Static assets
├── server/                # Backend (to be implemented in Phase 3)
├── docs/                  # Documentation
├── ARCHITECTURE.md        # System architecture
├── PROJECT_PLAN.md        # 10-phase roadmap
├── REQUIREMENTS_TRACEABILITY.md # Requirements matrix
├── UI_UX_BLUEPRINT.md     # Design specifications
├── PHASE_TRACKER.md       # Phase tracking
└── .env.example           # Environment template
```

## Design System

The application implements a premium fintech design system with:
- **Dark navy/graphite** base theme
- **Electric indigo/violet** primary accents
- **Cyan/emerald/amber/rose** semantic status colors
- **Inter** font for UI, **JetBrains Mono** for financial data
- **Glassmorphism** cards with backdrop blur
- **WCAG AA** compliant contrast ratios
- **Reduced motion** support
- **Responsive** from 375px mobile to 4K desktop

## Phase 2 Deliverables

✅ Frontend workspace initialized with Vite + React + TypeScript
✅ Tailwind CSS configured with custom design tokens
✅ Reusable component library (Button, Card, Input, Badge, Modal, Dropdown, Toast, Skeleton, Table, KPICard)
✅ Branded login screen with demo role selector
✅ Responsive application shell (collapsible sidebar, top nav, mobile drawer)
✅ Client-side routing with React Router
✅ Role-preview switcher (Employee/Director/Accounts)
✅ Employee screens: Dashboard, My Vouchers, Create Voucher, Voucher Detail
✅ Director screens: Dashboard, Approval Queue, Voucher Review
✅ Accounts screens: Dashboard, Voucher Register, Voucher Detail
✅ Centralized demo data module
✅ Micro-interactions with Framer Motion
✅ Responsive design (375px - 4K)
✅ Accessibility features (WCAG AA, keyboard navigation, ARIA)

## Next Steps (Phase 3)

- Initialize backend Express + TypeScript workspace
- Configure Prisma ORM with PostgreSQL schema
- Write database migrations
- Create seed script with demo users for all 3 roles
- Implement centralized error handler and health checks

## License

Internal project for Prachay Securities Private Limited.