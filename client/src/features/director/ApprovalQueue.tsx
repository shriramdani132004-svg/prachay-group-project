import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Filter, Eye, IndianRupee } from 'lucide-react'
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
import { EmptyState } from '@/components/feedback/EmptyState'
import { TableSkeleton } from '@/components/feedback/Skeleton'
import { useToast } from '@/components/feedback/Toast'
import { useVoucherList, useDepartments, useExpenseCategories } from '@/hooks/useVouchers'
import type { ApiVoucherStatus } from '@/lib/api'

/**
 * Approval Queue / All Vouchers (Phases 6/7).
 *
 * Read-only organization-wide register with the SAME server-validated
 * search/filter/sort/pagination contract used by the Accounts register.
 * Decisions happen on the review page; this register never mutates.
 */

const statusOptions: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'DRAFT', label: 'Draft' },
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

const DEFAULT_FILTERS: Filters = {
  search: '',
  status: 'PENDING_APPROVAL',
  departmentId: '',
  expenseCategoryId: '',
  dateFrom: '',
  dateTo: '',
  minAmount: '',
  maxAmount: '',
  sortBy: 'createdAt',
  sortOrder: 'asc',
  page: 1,
  pageSize: 10,
}

function parseAmount(value: string): number | undefined {
  if (value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

export function ApprovalQueue() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const { data: departments } = useDepartments()
  const { data: categories } = useExpenseCategories()

  const minAmount = parseAmount(filters.minAmount)
  const maxAmount = parseAmount(filters.maxAmount)
  const invalidAmountRange = minAmount !== undefined && maxAmount !== undefined && minAmount > maxAmount
  const invalidDateRange = Boolean(filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo)

  const { data, isLoading, isError, error, refetch } = useVoucherList({
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
  })

  useEffect(() => {
    if (isError) {
      toast({
        type: 'error',
        title: 'Could not load vouchers',
        message: error instanceof Error ? error.message : undefined,
      })
    }
  }, [isError, error, toast])

  const items = data?.data.items ?? []
  const pagination = data?.meta?.pagination

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

  const clearFilters = () => setFilters({ ...DEFAULT_FILTERS, status: '' })

  const hasActiveFilters =
    filters.search !== '' ||
    filters.status !== '' ||
    filters.departmentId !== '' ||
    filters.expenseCategoryId !== '' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '' ||
    filters.minAmount !== '' ||
    filters.maxAmount !== ''

  const departmentOptions = useMemo(
    () => [
      { value: '', label: 'All Departments' },
      ...(departments ?? []).map((d) => ({ value: d.id, label: d.name })),
    ],
    [departments],
  )
  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'All Categories' },
      ...(categories ?? []).map((c) => ({ value: c.id, label: c.name })),
    ],
    [categories],
  )

  return (
    <div className="page-container animate-fade-in">
      <PageHeader
        title="Approval Queue"
        description="Organization-wide voucher register. Open a voucher to review and decide."
        actions={
          <Link to="/director">
            <Button variant="ghost">Dashboard</Button>
          </Link>
        }
      />

      <Card className="mb-6" padding="md">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="search"
              placeholder="Search number, title, employee..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="input pl-10"
              aria-label="Search vouchers"
            />
          </div>
          <div className="hidden lg:flex items-center gap-2 flex-1 justify-end">
            {showAdvanced && (
              <>
                <Select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  options={statusOptions}
                  className="w-44"
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
            <Button variant="ghost" onClick={() => setShowAdvanced(!showAdvanced)}>
              <Filter className="h-4 w-4 mr-2" />
              {showAdvanced ? 'Hide' : 'Show'} Filters
            </Button>
          </div>
        </div>

        {showAdvanced && (
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
          <TableSkeleton rows={filters.pageSize > 5 ? 5 : filters.pageSize} columns={7} />
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <IndianRupee className="h-8 w-8 text-error" aria-hidden />
            <p className="text-body text-text-secondary">Failed to load vouchers.</p>
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No vouchers found"
            description={
              hasActiveFilters
                ? 'No vouchers match the current filters.'
                : 'There are no vouchers in the system yet.'
            }
            action={
              hasActiveFilters
                ? { label: 'Clear filters', onClick: clearFilters }
                : { label: 'Go to dashboard', onClick: () => navigate('/director') }
            }
          />
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
                  <TableHead
                    sortable
                    onSort={() => handleSort('createdAt')}
                    sortDirection={filters.sortBy === 'createdAt' ? filters.sortOrder : null}
                  >
                    Employee
                  </TableHead>
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
                  <TableHead className="w-20">Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((voucher) => (
                  <TableRow key={voucher.id}>
                    <TableCell className="font-mono font-medium">{voucher.voucherNumber}</TableCell>
                    <TableCell className="font-medium text-text-primary">
                      {voucher.expenseTitle}
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
                      <Link to={`/director/vouchers/${voucher.id}`}>
                        <Button variant="ghost" size="icon" aria-label={`Review ${voucher.voucherNumber}`}>
                          <Eye className="h-4 w-4" />
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
