import type { User, Voucher, VoucherStatus, UserRole, DashboardKPIs } from '@/lib/utils'

export const demoUsers: User[] = [
  {
    id: 'emp-001',
    email: 'rajesh.kumar@pspl.com',
    fullName: 'Rajesh Kumar',
    employeeId: 'EMP001',
    department: 'Equity Trading',
    role: 'EMPLOYEE',
  },
  {
    id: 'emp-002',
    email: 'priya.sharma@pspl.com',
    fullName: 'Priya Sharma',
    employeeId: 'EMP002',
    department: 'Investment Banking',
    role: 'EMPLOYEE',
  },
  {
    id: 'emp-003',
    email: 'arun.patel@pspl.com',
    fullName: 'Arun Patel',
    employeeId: 'EMP003',
    department: 'Compliance',
    role: 'EMPLOYEE',
  },
  {
    id: 'dir-001',
    email: 'sanjay.mehta@pspl.com',
    fullName: 'Sanjay Mehta',
    employeeId: 'DIR001',
    department: 'Executive',
    role: 'DIRECTOR',
  },
  {
    id: 'acc-001',
    email: 'finance.team@pspl.com',
    fullName: 'Finance Team',
    employeeId: 'ACC001',
    department: 'Accounts',
    role: 'ACCOUNTS',
  },
]

export const demoVouchers: Voucher[] = [
  {
    id: 'vch-001',
    voucherNumber: 'VCH-20261001-0001',
    voucherDate: '2026-10-01',
    expenseDate: '2026-09-28',
    department: 'Equity Trading',
    expenseTitle: 'Client Meeting - Mumbai',
    expenseCategory: 'Travel',
    expenseDescription: 'Travel expenses for client meeting in Mumbai including flight, hotel, and local transport.',
    amount: 45000,
    status: 'APPROVED',
    employeeSignatureUrl: '/signatures/emp-001.png',
    directorSignatureUrl: '/signatures/dir-001.png',
    approvedAt: '2026-10-02T10:30:00Z',
    createdById: 'emp-001',
    reviewedById: 'dir-001',
    createdAt: '2026-10-01T09:15:00Z',
    updatedAt: '2026-10-02T10:30:00Z',
    employee: demoUsers[0],
    director: demoUsers[3],
  },
  {
    id: 'vch-002',
    voucherNumber: 'VCH-20261003-0002',
    voucherDate: '2026-10-03',
    expenseDate: '2026-10-01',
    department: 'Investment Banking',
    expenseTitle: 'Deal Documentation Software',
    expenseCategory: 'Software',
    expenseDescription: 'Annual license for deal documentation and collaboration platform.',
    amount: 125000,
    status: 'PENDING_APPROVAL',
    employeeSignatureUrl: '/signatures/emp-002.png',
    submittedAt: '2026-10-03T14:20:00Z',
    createdById: 'emp-002',
    createdAt: '2026-10-03T14:15:00Z',
    updatedAt: '2026-10-03T14:20:00Z',
    employee: demoUsers[1],
  },
  {
    id: 'vch-003',
    voucherNumber: 'VCH-20261005-0003',
    voucherDate: '2026-10-05',
    expenseDate: '2026-10-03',
    department: 'Compliance',
    expenseTitle: 'Regulatory Filing Fees',
    expenseCategory: 'Utilities',
    expenseDescription: 'Quarterly regulatory filing fees for SEBI compliance.',
    amount: 75000,
    status: 'REJECTED',
    employeeSignatureUrl: '/signatures/emp-003.png',
    directorSignatureUrl: '/signatures/dir-001.png',
    rejectionReason: 'Expense category incorrect. Should be categorized under Subscriptions, not Utilities. Please resubmit with correct category.',
    rejectedAt: '2026-10-06T11:00:00Z',
    createdById: 'emp-003',
    reviewedById: 'dir-001',
    createdAt: '2026-10-05T16:45:00Z',
    updatedAt: '2026-10-06T11:00:00Z',
    employee: demoUsers[2],
    director: demoUsers[3],
  },
  {
    id: 'vch-004',
    voucherNumber: 'VCH-20261007-0004',
    voucherDate: '2026-10-07',
    expenseDate: '2026-10-05',
    department: 'Equity Trading',
    expenseTitle: 'Team Lunch - Quarterly Review',
    expenseCategory: 'Client Entertainment',
    expenseDescription: 'Team lunch for quarterly performance review meeting with 12 attendees.',
    amount: 18500,
    status: 'SUBMITTED',
    employeeSignatureUrl: '/signatures/emp-001.png',
    submittedAt: '2026-10-07T12:30:00Z',
    createdById: 'emp-001',
    createdAt: '2026-10-07T12:25:00Z',
    updatedAt: '2026-10-07T12:30:00Z',
    employee: demoUsers[0],
  },
  {
    id: 'vch-005',
    voucherNumber: 'VCH-20261008-0005',
    voucherDate: '2026-10-08',
    expenseDate: '2026-10-06',
    department: 'Operations',
    expenseTitle: 'Office Supplies - Q4 Restock',
    expenseCategory: 'Office Supplies',
    expenseDescription: 'Quarterly restock of office supplies including stationery, printer cartridges, and cleaning supplies.',
    amount: 32000,
    status: 'DRAFT',
    createdById: 'emp-002',
    createdAt: '2026-10-08T10:00:00Z',
    updatedAt: '2026-10-08T10:00:00Z',
    employee: demoUsers[1],
  },
  {
    id: 'vch-006',
    voucherNumber: 'VCH-20261009-0006',
    voucherDate: '2026-10-09',
    expenseDate: '2026-10-07',
    department: 'IT',
    expenseTitle: 'Cloud Infrastructure - AWS',
    expenseCategory: 'Software',
    expenseDescription: 'Monthly AWS cloud infrastructure costs for development and staging environments.',
    amount: 210000,
    status: 'APPROVED',
    employeeSignatureUrl: '/signatures/emp-003.png',
    directorSignatureUrl: '/signatures/dir-001.png',
    approvedAt: '2026-10-09T16:45:00Z',
    createdById: 'emp-003',
    reviewedById: 'dir-001',
    createdAt: '2026-10-09T09:30:00Z',
    updatedAt: '2026-10-09T16:45:00Z',
    employee: demoUsers[2],
    director: demoUsers[3],
  },
  {
    id: 'vch-007',
    voucherNumber: 'VCH-20261010-0007',
    voucherDate: '2026-10-10',
    expenseDate: '2026-10-08',
    department: 'Investment Banking',
    expenseTitle: 'Conference Attendance - Delhi',
    expenseCategory: 'Travel',
    expenseDescription: 'Travel and accommodation for FinTech Conference 2026 in Delhi.',
    amount: 85000,
    status: 'PENDING_APPROVAL',
    employeeSignatureUrl: '/signatures/emp-001.png',
    submittedAt: '2026-10-10T11:00:00Z',
    createdById: 'emp-001',
    createdAt: '2026-10-10T10:55:00Z',
    updatedAt: '2026-10-10T11:00:00Z',
    employee: demoUsers[0],
  },
  {
    id: 'vch-008',
    voucherNumber: 'VCH-20261010-0008',
    voucherDate: '2026-10-10',
    expenseDate: '2026-10-09',
    department: 'Compliance',
    expenseTitle: 'Legal Consultation Fees',
    expenseCategory: 'Miscellaneous',
    expenseDescription: 'External legal counsel fees for regulatory advisory on new SEBI guidelines.',
    amount: 150000,
    status: 'DRAFT',
    createdById: 'emp-003',
    createdAt: '2026-10-10T14:20:00Z',
    updatedAt: '2026-10-10T14:20:00Z',
    employee: demoUsers[2],
  },
]

export const departments = [
  'Equity Trading',
  'Investment Banking',
  'Compliance',
  'Operations',
  'IT',
  'Research',
]

export const expenseCategories = [
  'Travel',
  'Client Entertainment',
  'Office Supplies',
  'Software',
  'Utilities',
  'Subscriptions',
  'Miscellaneous',
]

export function getVouchersByStatus(status: VoucherStatus): Voucher[] {
  return demoVouchers.filter((v) => v.status === status)
}

export function getVouchersByEmployee(employeeId: string): Voucher[] {
  return demoVouchers.filter((v) => v.createdById === employeeId)
}

export function getVouchersByRole(role: UserRole, userId?: string): Voucher[] {
  switch (role) {
    case 'EMPLOYEE':
      return userId ? demoVouchers.filter((v) => v.createdById === userId) : []
    case 'DIRECTOR':
    case 'ACCOUNTS':
      return demoVouchers
    default:
      return []
  }
}

export function getDashboardKPIs(role: UserRole, userId?: string): DashboardKPIs {
  const vouchers = getVouchersByRole(role, userId)

  const base = {
    totalVouchers: vouchers.length,
    draftVouchers: vouchers.filter((v) => v.status === 'DRAFT').length,
    pendingApproval: vouchers.filter((v) => v.status === 'SUBMITTED' || v.status === 'PENDING_APPROVAL').length,
    approvedVouchers: vouchers.filter((v) => v.status === 'APPROVED').length,
    rejectedVouchers: vouchers.filter((v) => v.status === 'REJECTED').length,
    totalAmountClaimed: vouchers.reduce((sum, v) => sum + v.amount, 0),
  }

  if (role === 'DIRECTOR') {
    const today = new Date().toISOString().split('T')[0]
    return {
      ...base,
      pendingApprovalCount: vouchers.filter((v) => v.status === 'SUBMITTED' || v.status === 'PENDING_APPROVAL').length,
      approvedToday: vouchers.filter((v) => v.status === 'APPROVED' && v.approvedAt?.startsWith(today)).length,
      rejectedToday: vouchers.filter((v) => v.status === 'REJECTED' && v.rejectedAt?.startsWith(today)).length,
      totalPendingAmount: vouchers
        .filter((v) => v.status === 'SUBMITTED' || v.status === 'PENDING_APPROVAL')
        .reduce((sum, v) => sum + v.amount, 0),
    }
  }

  if (role === 'ACCOUNTS') {
    return {
      ...base,
      totalApprovedExpenseAmount: vouchers.filter((v) => v.status === 'APPROVED').reduce((sum, v) => sum + v.amount, 0),
      recentApprovedVouchers: vouchers.filter((v) => v.status === 'APPROVED').slice(-5).length,
    }
  }

  return base
}