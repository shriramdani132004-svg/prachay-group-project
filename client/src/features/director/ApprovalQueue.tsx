import { useState, useMemo } from 'react'
import { Search, Filter, ChevronDown, Clock, Eye, CheckCircle, XCircle, X } from 'lucide-react'
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
import { demoVouchers, departments, expenseCategories } from '@/data/demo-data'
import { useDemoAuth } from '@/hooks/useDemoAuth'
import { Modal, ConfirmDialog } from '@/components/overlays/Modal'
import { cn } from '@/lib/utils'

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

const departmentOptions = [{ value: '', label: 'All Departments' }, ...departments.map((d) => ({ value: d, label: d }))]
const categoryOptions = [{ value: '', label: 'All Categories' }, ...expenseCategories.map((c) => ({ value: c, label: c }))]

export function ApprovalQueue() {
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
    limit: 10,
  })

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [selectedVoucher, setSelectedVoucher] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [directorSignature, setDirectorSignature] = useState<string>('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [approveLoading, setApproveLoading] = useState(false)
  const [rejectLoading, setRejectLoading] = useState(false)

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

  const pendingVouchers = filteredVouchers.filter((v) => v.status === 'SUBMITTED' || v.status === 'PENDING_APPROVAL')
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
      limit: 10,
    })
  }

  const hasActiveFilters = Object.entries(filters).some(
    ([key, value]) => key !== 'sortBy' && key !== 'sortOrder' && key !== 'page' && key !== 'limit' && value !== ''
  )

  const openReview = (voucherId: string) => {
    setSelectedVoucher(voucherId)
  }

  const handleApprove = async () => {
    if (!directorSignature) return
    setApproveLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    console.log('Approve voucher:', selectedVoucher, 'with signature')
    setApproveLoading(false)
    setShowApproveModal(false)
    setDirectorSignature('')
  }

  const handleReject = async () => {
    if (!rejectReason.trim() || rejectReason.trim().length < 5) return
    setRejectLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    console.log('Reject voucher:', selectedVoucher, 'reason:', rejectReason)
    setRejectLoading(false)
    setShowRejectModal(false)
    setRejectReason('')
  }

  return (
    <div className="page-container animate-fade-in">
      <PageHeader
        title="Approval Queue"
        description="Review and approve or reject pending expense vouchers"
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
                  <TableHead sortable onSort={() => handleSort('expenseTitle')} sortDirection={filters.sortBy === 'expenseTitle' ? filters.sortOrder : null}>Title</TableHead>
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
                    <TableCell>
                      <p className="font-medium text-text-primary">{voucher.expenseTitle}</p>
                    </TableCell>
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
                          onClick={() => openReview(voucher.id)}
                          aria-label="Review voucher"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(voucher.status === 'SUBMITTED' || voucher.status === 'PENDING_APPROVAL') && (
                          <>
                            <Button
                              variant="primary"
                              size="icon"
                              onClick={() => {
                                setSelectedVoucher(voucher.id)
                                setShowApproveModal(true)
                              }}
                              aria-label="Approve voucher"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => {
                                setSelectedVoucher(voucher.id)
                                setShowRejectModal(true)
                              }}
                              aria-label="Reject voucher"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
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

      <Modal
        isOpen={showApproveModal}
        onClose={() => { setShowApproveModal(false); setDirectorSignature('') }}
        title="Approve Voucher"
        description="Add your digital signature to authorize this voucher"
        size="md"
      >
        {selectedVoucher && (
          <div className="space-y-4">
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-input">
              <p className="font-medium text-amber-400">Voucher: {demoVouchers.find(v => v.id === selectedVoucher)?.voucherNumber}</p>
              <p className="text-caption text-text-secondary mt-1">Amount: {formatCurrency(demoVouchers.find(v => v.id === selectedVoucher)?.amount || 0)}</p>
            </div>
            <p className="text-body text-text-secondary">Provide your digital signature to approve this voucher:</p>
            <div className="bg-bg-base border border-border-subtle rounded-input p-4 min-h-[150px] relative">
              {directorSignature ? (
                <div className="relative w-full h-full">
                  <img src={directorSignature} alt="Director signature" className="max-w-full max-h-full" />
                  <button
                    type="button"
                    onClick={() => setDirectorSignature('')}
                    className="absolute top-2 right-2 btn-icon p-1.5 text-red-400 hover:text-red-300"
                    aria-label="Clear signature"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <SignaturePadDemo onSignature={setDirectorSignature} />
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => { setShowApproveModal(false); setDirectorSignature('') }}>Cancel</Button>
              <Button variant="primary" onClick={handleApprove} loading={approveLoading} disabled={!directorSignature}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Voucher
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={showRejectModal}
        onClose={() => { setShowRejectModal(false); setRejectReason('') }}
        onConfirm={handleReject}
        title="Reject Voucher"
        message="Please provide a mandatory rejection reason (minimum 5 characters). This will be visible to the employee."
        confirmText="Reject Voucher"
        cancelText="Cancel"
        variant="destructive"
        loading={rejectLoading}
      >
        <div className="mb-4">
          <label className="label">Rejection Reason</label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
            className="input min-h-[100px] resize-y"
            placeholder="Enter rejection reason..."
            minLength={5}
          />
          <p className={cn('text-caption mt-1', rejectReason.length >= 5 ? 'text-emerald-400' : 'text-text-muted')}>
            {rejectReason.length >= 5 ? 'Reason is valid' : `Minimum 5 characters required (${rejectReason.length}/5)`}
          </p>
        </div>
      </ConfirmDialog>
    </div>
  )
}

function SignaturePadDemo({ onSignature }: { onSignature: (dataUrl: string) => void }) {
  const [strokes, setStrokes] = useState<{ x: number; y: number }[][]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const canvasRef = useState<HTMLCanvasElement | null>(null)
  const [, setCanvasRef] = canvasRef

  const handleStart = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    setIsDrawing(true)
    setStrokes([[{ x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) }]])
  }

  const handleMove = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    if (!isDrawing) return
    e.preventDefault()
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    setStrokes((prev) => {
      const newStrokes = [...prev]
      newStrokes[newStrokes.length - 1].push({
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height),
      })
      return newStrokes
    })
  }

  const handleEnd = () => setIsDrawing(false)

  const handleConfirm = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#F8FAFC'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      strokes.forEach((stroke) => {
        if (stroke.length < 2) return
        ctx.beginPath()
        ctx.moveTo(stroke[0].x, stroke[0].y)
        for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y)
        ctx.stroke()
      })

      onSignature(canvas.toDataURL('image/png'))
    }
  }

  return (
    <div className="relative">
      <canvas
        ref={setCanvasRef}
        className="w-full h-full cursor-crosshair touch-none"
        width={600}
        height={200}
        onMouseDown={(e) => handleStart(e, canvasRef[0]!)}
        onMouseMove={(e) => handleMove(e, canvasRef[0]!)}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={(e) => handleStart(e, canvasRef[0]!)}
        onTouchMove={(e) => handleMove(e, canvasRef[0]!)}
        onTouchEnd={handleEnd}
      />
      {!strokes.length && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted pointer-events-none">
          <p className="text-body">Draw your signature here</p>
          <p className="text-caption">Click and drag or use touch</p>
        </div>
      )}
      <div className="absolute bottom-2 right-2 flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => setStrokes([])} disabled={!strokes.length}>Clear</Button>
        <Button variant="primary" size="sm" onClick={() => handleConfirm(canvasRef[0]!)} disabled={!strokes.length}>Confirm</Button>
      </div>
    </div>
  )
}