import { useState, useMemo } from 'react'
import { Search, Filter, ChevronDown, Eye, Download, FileText, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
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
import { demoVouchers, departments, expenseCategories } from '@/data/demo-data'
import { useDemoAuth } from '@/hooks/useDemoAuth'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/overlays/Modal'

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

const departmentOptions = [{ value: '', label: 'All Departments' }, ...departments.map((d) => ({ value: d, label: d }))]
const categoryOptions = [{ value: '', label: 'All Categories' }, ...expenseCategories.map((c) => ({ value: c, label: c }))]

export function VoucherRegister() {
  const [filters, setFilters] = useState({
    search: '',
    department: '',
    category: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: '',
    sortBy: 'createdAt',
    sortOrder: 'desc' as 'asc' | 'desc',
    page: 1,
    limit: 15,
  })

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [selectedVoucher, setSelectedVoucher] = useState<string | null>(null)

  const allVouchers = demoVouchers

  const filteredVouchers = useMemo(() => {
    let result = [...allVouchers]

    if (filters.search) {
      const search = filters.search.toLowerCase()
      result = result.filter(
        (v) =>
          v.voucherNumber.toLowerCase().includes(search) ||
          v.expenseTitle.toLowerCase().includes(search) ||
          v.employee?.fullName.toLowerCase().includes(search)
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
      const aVal = a[filters.sortBy as keyof typeof a]
      const bVal = b[filters.sortBy as keyof typeof b]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (aVal < bVal) return filters.sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return filters.sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [allVouchers, filters])

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

  const handleFilterChange = (key: string, value: string) => {
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
      limit: 15,
    })
  }

  const hasActiveFilters = Object.entries(filters).some(
    ([key, value]) => key !== 'sortBy' && key !== 'sortOrder' && key !== 'page' && key !== 'limit' && value !== ''
  )

  const openDetail = (voucherId: string) => {
    setSelectedVoucher(voucherId)
  }

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
              type="text"
              placeholder="Search vouchers, employees, titles..."
              value={filters.search}
              onChange={handleSearch}
              className="input pl-10"
            />
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
            <Input label="Date From" type="date" value={filters.dateFrom} onChange={(e) => handleFilterChange('dateFrom', e.target.value)} />
            <Input label="Date To" type="date" value={filters.dateTo} onChange={(e) => handleFilterChange('dateTo', e.target.value)} />
            <Input label="Min Amount (₹)" type="number" value={filters.minAmount} onChange={(e) => handleFilterChange('minAmount', e.target.value)} placeholder="0" />
            <Input label="Max Amount (₹)" type="number" value={filters.maxAmount} onChange={(e) => handleFilterChange('maxAmount', e.target.value)} placeholder="1000000" />
          </div>
        )}

        {hasActiveFilters && (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-caption text-text-muted">{totalItems} result{totalItems !== 1 ? 's' : ''} found</span>
            <Button variant="ghost" size="sm" onClick={clearFilters}>Clear all filters</Button>
          </div>
        )}
      </Card>

      <Card>
        {paginatedVouchers.length === 0 ? (
          <EmptyVouchers onClearFilters={clearFilters} />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead sortable onSort={() => handleSort('voucherNumber')} sortDirection={filters.sortBy === 'voucherNumber' ? filters.sortOrder : null}>Voucher #</TableHead>
                  <TableHead sortable onSort={() => handleSort('employee.fullName')} sortDirection={filters.sortBy === 'employee.fullName' ? filters.sortOrder : null}>Employee</TableHead>
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
                    <TableCell>{voucher.employee?.fullName || 'Unknown'}</TableCell>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDetail(voucher.id)}
                          aria-label="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Export voucher">
                          <Download className="h-4 w-4" />
                        </Button>
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

      <Modal
        isOpen={!!selectedVoucher}
        onClose={() => setSelectedVoucher(null)}
        title="Voucher Details"
        size="lg"
      >
        {selectedVoucher && (
          <VoucherDetailModal voucher={demoVouchers.find((v) => v.id === selectedVoucher)!} onClose={() => setSelectedVoucher(null)} />
        )}
      </Modal>
    </div>
  )
}

function VoucherDetailModal({ voucher, onClose }: { voucher: typeof demoVouchers[0]; onClose: () => void }) {
  if (!voucher) return null

  const statusConfig = {
    DRAFT: { icon: FileText, color: 'badge-draft', label: 'Draft' },
    SUBMITTED: { icon: Clock, color: 'badge-submitted', label: 'Submitted' },
    PENDING_APPROVAL: { icon: Clock, color: 'badge-pending', label: 'Pending Approval' },
    APPROVED: { icon: CheckCircle, color: 'badge-approved', label: 'Approved' },
    REJECTED: { icon: XCircle, color: 'badge-rejected', label: 'Rejected' },
  }

  const currentStatus = statusConfig[voucher.status as keyof typeof statusConfig]
  const StatusIcon = currentStatus.icon

  const timelineSteps = [
    { key: 'DRAFT', label: 'Created (Draft)', date: voucher.createdAt, completed: true },
    { key: 'SUBMITTED', label: 'Submitted', date: voucher.submittedAt, completed: ['SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'].includes(voucher.status) },
    { key: 'PENDING_APPROVAL', label: 'Pending Approval', date: voucher.submittedAt, completed: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'].includes(voucher.status) },
    { key: 'APPROVED', label: 'Approved', date: voucher.approvedAt, completed: voucher.status === 'APPROVED' },
    { key: 'REJECTED', label: 'Rejected', date: voucher.rejectedAt, completed: voucher.status === 'REJECTED' },
  ]

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-4">
      {voucher.status === 'REJECTED' && voucher.rejectionReason && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-card" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-body font-medium text-rose-400">Voucher Rejected</p>
              <p className="text-body text-text-secondary mt-1">{voucher.rejectionReason}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-h2 text-text-primary flex items-center gap-2">
              <StatusIcon className="h-5 w-5" />
              {voucher.voucherNumber}
            </h3>
            <Badge variant={voucher.status.toLowerCase() as any}>
              {voucher.status.replace('_', ' ')}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-caption text-text-muted">Voucher Date</p>
              <p className="font-mono text-text-primary">{formatDate(voucher.voucherDate)}</p>
            </div>
            <div>
              <p className="text-caption text-text-muted">Expense Date</p>
              <p className="text-text-primary">{formatDate(voucher.expenseDate)}</p>
            </div>
            <div>
              <p className="text-caption text-text-muted">Department</p>
              <p className="text-text-primary">{voucher.department}</p>
            </div>
            <div>
              <p className="text-caption text-text-muted">Category</p>
              <p className="text-text-primary">{voucher.expenseCategory}</p>
            </div>
          </div>

          <div>
            <p className="text-caption text-text-muted">Expense Title</p>
            <p className="font-medium text-text-primary">{voucher.expenseTitle}</p>
          </div>

          <div>
            <p className="text-caption text-text-muted">Description</p>
            <p className="text-text-primary whitespace-pre-wrap">{voucher.expenseDescription || 'No description provided'}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-baseline gap-4">
            <span className="text-display tabular-nums font-bold text-text-primary">{formatCurrency(voucher.amount)}</span>
            <Badge variant={voucher.status.toLowerCase() as any}>
              {voucher.status.replace('_', ' ')}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-caption text-text-muted">Created</p>
              <p className="font-mono text-text-primary">{formatDateTime(voucher.createdAt)}</p>
            </div>
            {voucher.submittedAt && (
              <div>
                <p className="text-caption text-text-muted">Submitted</p>
                <p className="font-mono text-text-primary">{formatDateTime(voucher.submittedAt)}</p>
              </div>
            )}
            {voucher.approvedAt && (
              <div>
                <p className="text-caption text-text-muted">Approved</p>
                <p className="font-mono text-text-primary">{formatDateTime(voucher.approvedAt)}</p>
              </div>
            )}
            {voucher.rejectedAt && (
              <div>
                <p className="text-caption text-text-muted">Rejected</p>
                <p className="font-mono text-text-primary">{formatDateTime(voucher.rejectedAt)}</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border-subtle">
            <h4 className="text-body font-medium text-text-primary mb-3">Signatures</h4>
            <div className="grid grid-cols-2 gap-4">
              {voucher.employeeSignatureUrl && (
                <div>
                  <p className="text-caption text-text-muted mb-2">Employee Signature</p>
                  <div className="bg-bg-base border border-border-subtle rounded-input p-4 min-h-[100px] flex items-center justify-center">
                    <img src={voucher.employeeSignatureUrl} alt="Employee signature" className="max-w-full max-h-[80px]" />
                  </div>
                </div>
              )}
              {voucher.directorSignatureUrl && (
                <div>
                  <p className="text-caption text-text-muted mb-2">Director Signature</p>
                  <div className="bg-bg-base border border-border-subtle rounded-input p-4 min-h-[100px] flex items-center justify-center">
                    <img src={voucher.directorSignatureUrl} alt="Director signature" className="max-w-full max-h-[80px]" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-border-subtle flex justify-end">
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
    </div>
  )
}