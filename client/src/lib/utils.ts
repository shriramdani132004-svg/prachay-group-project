import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function generateVoucherNumber(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `VCH-${year}${month}${day}-${random}`
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function getStatusColor(status: VoucherStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'badge-draft'
    case 'SUBMITTED':
      return 'badge-submitted'
    case 'PENDING_APPROVAL':
      return 'badge-pending'
    case 'APPROVED':
      return 'badge-approved'
    case 'REJECTED':
      return 'badge-rejected'
    default:
      return 'badge-draft'
  }
}

export type VoucherStatus = 'DRAFT' | 'SUBMITTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'

export type UserRole = 'EMPLOYEE' | 'DIRECTOR' | 'ACCOUNTS'

export interface User {
  id: string
  email: string
  fullName: string
  employeeId: string
  department: string
  role: UserRole
  avatarUrl?: string
}

export interface Voucher {
  id: string
  voucherNumber: string
  voucherDate: string
  expenseDate: string
  department: string
  expenseTitle: string
  expenseCategory: string
  expenseDescription: string
  amount: number
  status: VoucherStatus
  employeeSignatureUrl?: string
  directorSignatureUrl?: string
  rejectionReason?: string
  submittedAt?: string
  approvedAt?: string
  rejectedAt?: string
  createdById: string
  reviewedById?: string
  createdAt: string
  updatedAt: string
  employee?: User
  director?: User
}

export interface DashboardKPIs {
  totalVouchers: number
  draftVouchers: number
  pendingApproval: number
  approvedVouchers: number
  rejectedVouchers: number
  totalAmountClaimed: number
  pendingApprovalCount?: number
  approvedToday?: number
  rejectedToday?: number
  totalPendingAmount?: number
  totalApprovedExpenseAmount?: number
  recentApprovedVouchers?: number
}

export interface FilterState {
  search: string
  department: string
  category: string
  status: string
  dateFrom: string
  dateTo: string
  minAmount: string
  maxAmount: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
  page: number
  limit: number
}