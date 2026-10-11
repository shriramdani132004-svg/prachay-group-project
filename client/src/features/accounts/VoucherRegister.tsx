import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Filter, FileText, AlertCircle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card } from '@/components/common/Card'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Pagination,
} from '@/components/data-display/Table'
import { Badge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { Input, Select } from '@/components/forms/Input'
import { PageHeader } from '@/components/layout/TopNav'
import { EmptyVouchers } from '@/components/feedback/EmptyState'
import { TableSkeleton } from '@/components/feedback/Skeleton'
import { useToast } from '@/components/feedback/Toast'
import { useVoucherList, useDepartments, useExpenseCategories } from '@/hooks/useVouchers'
import type { ApiVoucherStatus } from '@/lib/api'

/**
 * Voucher Register (Phase 7).
 *
 * Accounts-facing, organization-wide READ-ONLY register. Server-side
 * search/filter/sort/pagination via the shared voucher-query contract. No
 * mutation controls exist on this page by policy: Accounts never create,
 * edit, approve or reject.
 */

const statusOptions: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

interface Filters {
  search: string
  status: string
  departmentId: string
  expenseCategoryId: string
  dateFrom: string
  dateTo: string
  minAmount: string
  maxAmount: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
}

const EMPTY_FILTERS: Filters = {
  search: '',
  status: '',
  departmentId: '',
  expenseCategoryId: '',
  dateFrom: '',
  dateTo: '',
  minAmount: '',
  maxAmount: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  page: 1,
  pageSize: 15,
}

function parseAmount(value: string): number | undefined {
  if (value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

export function VoucherRegister() {
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const initialStatus = searchParams.get('status') ?? ''
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS, status: initialStatus })
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [searchDraft, setSearchDraft] = useState('')

  const { data: departments } = useDepartments()
  const { data: categories } = useExpenseCategories()

  const minAmount = parseAmount(filters.minAmount)
  const maxAmount = parseAmount(filters.maxAmount)
  const invalidAmountRange = minAmount !== undefined && maxAmount !== undefined && minAmount > maxAmount
  const invalidDateRange = Boolean(filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo)

  const listParams = {
    page: filters.page,
    pageSize: filters.pageSize,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    search: filters.search || undefined,
    status: (filters.status || undefined) as ApiVoucherStatus | undefined,
    departmentId: filters.departmentId || undefined,
    expenseCategoryId: filters.expenseCategoryId || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    minAmount: invalidAmountRange ? undefined : minAmount,
    maxAmount: invalidAmountRange ? undefined : maxAmount,
  }

  const { data, isLoading, isError, error, refetch } = useVoucherList(listParams)

  const items = data?.data.items ?? []
  const pagination = data?.meta?.pagination

  useEffect(() => {
    if (isError) {
      toast({
        type: 'error',
        title: 'Could not load vouchers',
        message: error instanceof Error ? error.message : 'Please try again.',
      })
    }
  }, [isError, error, toast])

  const handleSort = (column: string) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === 'asc' ? 'desc' : 'asc',
      page: 1,
    }))
  }

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    setSearchDraft('')
  }

  const hasActiveFilters =
    filters.search !== '' ||
    filters.status !== '' ||
    filters.departmentId !== '' ||
    filters.expenseCategoryId !== '' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '' ||
    filters.minAmount !== '' ||
    filters.maxAmount !== ''

  const departmentOptions = [
    { value: '', label: 'All Departments' },
    ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
  ]
  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...(categories ?? []).map((c) => ({ value: c.id, label: c.name })),
  ]

  return (
    <div className="page-container animate-fade-in">
      <PageHeader
        title="Voucher Register"
        description="Organization-wide read-only view of all expense vouchers"
      />

      <Card className="mb-6" padding="md">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="search"
              placeholder="Search by number, title or employee..."
              value={searchDraft}
              onChange={(e) => {
                setSearchDraft(e.target.value)
                handleFilterChange('search', e.target.value)
              }}
              className="input pl-10"
              aria-label="Search vouchers"
            />
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <Button variant="ghost" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>

          <div className="hidden lg:flex items-center gap-2 flex-1 justify-end">
            {showAdvancedFilters && (
              <>
                <Select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  options={statusOptions}
                  className="w-40"
                  aria-label="Status filter"
                />
                <Select
                  value={filters.departmentId}
                  onChange={(e) => handleFilterChange('departmentId', e.target.value)}
                  options={departmentOptions}
                  className="w-44"
                  aria-label="Department filter"
                />
                <Select
                  value={filters.expenseCategoryId}
                  onChange={(e) => handleFilterChange('expenseCategoryId', e.target.value)}
                  options={categoryOptions}
                  className="w-44"
                  aria-label="Category filter"
                />
              </>
            )}
            <Button variant="ghost" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
              <Filter className="h-4 w-4 mr-2" />
              {showAdvancedFilters ? 'Hide' : 'Show'} Filters
            </Button>
          </div>
        </div>

        {showAdvancedFilters && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-border-subtle">
            <Input
              label="Date From"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              error={invalidDateRange ? 'From must be before To' : undefined}
            />
            <Input
              label="Date To"
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
            <Input
              label="Min Amount (₹)"
              type="number"
              min="0"
              step="0.01"
              value={filters.minAmount}
              onChange={(e) => handleFilterChange('minAmount', e.target.value)}
              error={invalidAmountRange ? 'Min cannot exceed Max' : undefined}
            />
            <Input
              label="Max Amount (₹)"
              type="number"
              min="0"
              step="0.01"
              value={filters.maxAmount}
              onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
            />
          </div>
        )}

        {hasActiveFilters && (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-caption text-text-muted">
              {pagination?.totalItems ?? items.length} result
              {(pagination?.totalItems ?? items.length) !== 1 ? 's' : ''} found
            </span>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear all filters
            </Button>
          </div>
        )}
      </Card>

      <Card>
        {isLoading ? (
          <TableSkeleton rows={filters.pageSize > 5 ? 5 : filters.pageSize} columns={8} />
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-error" aria-hidden />
            <p className="text-body text-text-secondary">Failed to load vouchers.</p>
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyVouchers onClearFilters={hasActiveFilters ? clearFilters : undefined} />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    sortable
                    onSort={() => handleSort('voucherNumber')}
                    sortDirection={filters.sortBy === 'voucherNumber' ? filters.sortOrder : null}
                  >
                    Voucher #
                  </TableHead>
                  <TableHead
                    sortable
                    onSort={() => handleSort('expenseTitle')}
                    sortDirection={filters.sortBy === 'expenseTitle' ? filters.sortOrder : null}
                  >
                    Title
                  </TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead
                    sortable
                    onSort={() => handleSort('expenseDate')}
                    sortDirection={filters.sortBy === 'expenseDate' ? filters.sortOrder : null}
                  >
                    Date
                  </TableHead>
                  <TableHead
                    sortable
                    onSort={() => handleSort('amount')}
                    sortDirection={filters.sortBy === 'amount' ? filters.sortOrder : null}
                    className="text-right"
                  >
                    Amount
                  </TableHead>
                  <TableHead
                    sortable
                    onSort={() => handleSort('status')}
                    sortDirection={filters.sortBy === 'status' ? filters.sortOrder : null}
                  >
                    Status
                  </TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((voucher) => (
                  <TableRow key={voucher.id}>
                    <TableCell className="font-mono font-medium">{voucher.voucherNumber}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-text-primary">{voucher.expenseTitle}</p>
                        <p className="text-caption text-text-muted">{voucher.departmentName}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-text-secondary">
                      {voucher.createdByName ?? '—'}
                    </TableCell>
                    <TableCell className="font-mono text-caption">
                      {formatDate(voucher.expenseDate)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-medium">
                      {formatCurrency(Number(voucher.amount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={voucher.status.toLowerCase() as Lowercase<ApiVoucherStatus>}>
                        {voucher.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link to={`/accounts/vouchers/${voucher.id}`}>
                        <Button variant="ghost" size="icon" aria-label={`View ${voucher.voucherNumber}`}>
                          <FileText className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {pagination && (
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                itemsPerPage={pagination.pageSize}
                onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
                onPageSizeChange={(size) =>
                  setFilters((prev) => ({ ...prev, pageSize: size, page: 1 }))
                }
              />
            )}
          </>
        )}
      </Card>
    </div>
  )
}
