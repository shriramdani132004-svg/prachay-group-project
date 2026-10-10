import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, Filter, Plus, ChevronDown, FileText } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card } from '@/components/common/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/data-display/Table'
import { Badge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/forms/Input'
import { Select } from '@/components/forms/Input'
import { PageHeader } from '@/components/layout/TopNav'
import { Pagination } from '@/components/data-display/Table'
import { Skeleton, TableSkeleton } from '@/components/feedback/Skeleton'
import { EmptyVouchers } from '@/components/feedback/EmptyState'
import { demoVouchers, getVouchersByEmployee, departments, expenseCategories } from '@/data/demo-data'
import { useDemoAuth } from '@/hooks/useDemoAuth'
import type { Voucher, VoucherStatus, FilterState } from '@/lib/utils'

const statusOptions: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

const departmentOptions = [{ value: '', label: 'All Departments' }, ...departments.map((d) => ({ value: d, label: d }))]
const categoryOptions = [{ value: '', label: 'All Categories' }, ...expenseCategories.map((c) => ({ value: c, label: c }))]

export function MyVouchers() {
  const { user } = useDemoAuth()
  const userVouchers = getVouchersByEmployee(user.id)

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    department: '',
    category: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    page: 1,
    limit: 10,
  })

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  const filteredVouchers = useMemo(() => {
    let result = [...userVouchers]

    if (filters.search) {
      const search = filters.search.toLowerCase()
      result = result.filter(
        (v) =>
          v.voucherNumber.toLowerCase().includes(search) ||
          v.expenseTitle.toLowerCase().includes(search) ||
          v.expenseCategory.toLowerCase().includes(search)
      )
    }

    if (filters.department) result = result.filter((v) => v.department === filters.department)
    if (filters.category) result = result.filter((v) => v.expenseCategory === filters.category)
    if (filters.status) result = result.filter((v) => v.status === filters.status)
    if (filters.dateFrom) result = result.filter((v) => v.expenseDate >= filters.dateFrom)
    if (filters.dateTo) result = result.filter((v) => v.expenseDate <= filters.dateTo)
    if (filters.minAmount) result = result.filter((v) => v.amount >= Number(filters.minAmount))
    if (filters.maxAmount) result = result.filter((v) => v.amount <= Number(filters.maxAmount))

    result.sort((a, b) => {
      const aVal = a[filters.sortBy as keyof Voucher]
      const bVal = b[filters.sortBy as keyof Voucher]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (aVal < bVal) return filters.sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return filters.sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [userVouchers, filters])

  const totalItems = filteredVouchers.length
  const totalPages = Math.ceil(totalItems / filters.limit)
  const paginatedVouchers = filteredVouchers.slice((filters.page - 1) * filters.limit, filters.page * filters.limit)

  const handleSort = (column: string) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === 'asc' ? 'desc' : 'asc',
      page: 1,
    }))
  }

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))
  }

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
  }

  const clearFilters = () => {
    setFilters({
      search: '',
      department: '',
      category: '',
      status: '',
      dateFrom: '',
      dateTo: '',
      minAmount: '',
      maxAmount: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      page: 1,
      limit: 10,
    })
  }

  const hasActiveFilters = Object.entries(filters).some(
    ([key, value]) => key !== 'sortBy' && key !== 'sortOrder' && key !== 'page' && key !== 'limit' && value !== ''
  )

  return (
    <div className="page-container animate-fade-in">
      <PageHeader
        title="My Vouchers"
        description="Manage and track all your expense vouchers"
        actions={
          <Link to="/employee/vouchers/new">
            <Button variant="primary">
              <Plus className="h-4 w-4" />
              Create Voucher
            </Button>
          </Link>
        }
      />

      <Card className="mb-6" padding="md">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search vouchers..."
              value={filters.search}
              onChange={handleSearch}
              className="input pl-10"
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
                  placeholder="Status"
                  className="w-40"
                />
                <Select
                  value={filters.department}
                  onChange={(e) => handleFilterChange('department', e.target.value)}
                  options={departmentOptions}
                  placeholder="Department"
                  className="w-40"
                />
                <Select
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  options={categoryOptions}
                  placeholder="Category"
                  className="w-40"
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
              value={filters.minAmount}
              onChange={(e) => handleFilterChange('minAmount', e.target.value)}
              placeholder="0"
            />
            <Input
              label="Max Amount (₹)"
              type="number"
              value={filters.maxAmount}
              onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
              placeholder="1000000"
            />
          </div>
        )}

        {hasActiveFilters && (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-caption text-text-muted">{totalItems} result{totalItems !== 1 ? 's' : ''} found</span>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear all filters
            </Button>
          </div>
        )}
      </Card>

      <Card>
        {paginatedVouchers.length === 0 ? (
          <EmptyVouchers
            onCreate={() => window.location.href = '/employee/vouchers/new'}
            onClearFilters={clearFilters}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead sortable onSort={() => handleSort('voucherNumber')} sortDirection={filters.sortBy === 'voucherNumber' ? filters.sortOrder : null}>Voucher #</TableHead>
                  <TableHead sortable onSort={() => handleSort('expenseTitle')} sortDirection={filters.sortBy === 'expenseTitle' ? filters.sortOrder : null}>Title</TableHead>
                  <TableHead sortable onSort={() => handleSort('department')} sortDirection={filters.sortBy === 'department' ? filters.sortOrder : null}>Department</TableHead>
                  <TableHead sortable onSort={() => handleSort('expenseDate')} sortDirection={filters.sortBy === 'expenseDate' ? filters.sortOrder : null}>Date</TableHead>
                  <TableHead sortable onSort={() => handleSort('expenseCategory')} sortDirection={filters.sortBy === 'expenseCategory' ? filters.sortOrder : null}>Category</TableHead>
                  <TableHead sortable onSort={() => handleSort('amount')} sortDirection={filters.sortBy === 'amount' ? filters.sortOrder : null} className="text-right">Amount</TableHead>
                  <TableHead sortable onSort={() => handleSort('status')} sortDirection={filters.sortBy === 'status' ? filters.sortOrder : null}>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedVouchers.map((voucher) => (
                  <TableRow key={voucher.id}>
                    <TableCell className="font-mono font-medium">{voucher.voucherNumber}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-text-primary">{voucher.expenseTitle}</p>
                        <p className="text-caption text-text-muted">{voucher.department}</p>
                      </div>
                    </TableCell>
                    <TableCell>{voucher.department}</TableCell>
                    <TableCell className="font-mono text-caption">{formatDate(voucher.expenseDate)}</TableCell>
                    <TableCell>{voucher.expenseCategory}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-medium">{formatCurrency(voucher.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={voucher.status.toLowerCase() as any}>
                        {voucher.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Link to={`/employee/vouchers/${voucher.id}`}>
                          <Button variant="ghost" size="icon" aria-label="View details">
                            <FileText className="h-4 w-4" />
                          </Button>
                        </Link>
                        {voucher.status === 'DRAFT' && (
                          <Link to={`/employee/vouchers/${voucher.id}/edit`}>
                            <Button variant="ghost" size="icon" aria-label="Edit draft">
                              <FileText className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              currentPage={filters.page}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={filters.limit}
              onPageChange={handlePageChange}
              onPageSizeChange={(size) => setFilters((prev) => ({ ...prev, limit: size, page: 1 }))}
            />
          </>
        )}
      </Card>
    </div>
  )
}