import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Clock, CheckCircle, XCircle, FileText, User, Building2, Calendar, DollarSign, Shield, AlertTriangle, X } from 'lucide-react'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { PageHeader } from '@/components/layout/TopNav'
import { demoVouchers } from '@/data/demo-data'
import { useDemoAuth } from '@/hooks/useDemoAuth'
import { cn } from '@/lib/utils'
import { Modal, ConfirmDialog } from '@/components/overlays/Modal'
import { useState } from 'react'

export function VoucherReview() {
  const { id } = useParams<{ id: string }>()
  const { user } = useDemoAuth()
  const voucher = demoVouchers.find((v) => v.id === id)

  const [directorSignature, setDirectorSignature] = useState<string>('')
  const [rejectReason, setRejectReason] = useState('')
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [approveLoading, setApproveLoading] = useState(false)
  const [rejectLoading, setRejectLoading] = useState(false)

  if (!voucher) {
    return (
      <div className="page-container animate-fade-in">
        <PageHeader title="Voucher Not Found" description="The requested voucher does not exist." />
      </div>
    )
  }

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

  const canAct = voucher.status === 'SUBMITTED' || voucher.status === 'PENDING_APPROVAL'

  const handleApprove = async () => {
    if (!directorSignature) return
    setApproveLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    console.log('Approve voucher:', voucher.id, 'with signature')
    setApproveLoading(false)
    setShowApproveModal(false)
    setDirectorSignature('')
  }

  const handleReject = async () => {
    if (!rejectReason.trim() || rejectReason.trim().length < 5) return
    setRejectLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    console.log('Reject voucher:', voucher.id, 'reason:', rejectReason)
    setRejectLoading(false)
    setShowRejectModal(false)
    setRejectReason('')
  }

  return (
    <div className="page-container animate-fade-in">
      <PageHeader
        title="Voucher Review"
        description={voucher.voucherNumber}
        breadcrumbs={[
          { label: 'Dashboard', path: '/director' },
          { label: 'Approval Queue', path: '/director/approvals' },
          { label: 'Review' },
        ]}
        actions={
          <Link to="/director/approvals">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Queue
            </Button>
          </Link>
        }
      />

      {voucher.status === 'REJECTED' && voucher.rejectionReason && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-card animate-slide-up" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-body font-medium text-rose-400">Voucher Rejected</p>
              <p className="text-body text-text-secondary mt-1">{voucher.rejectionReason}</p>
              {voucher.rejectedAt && (
                <p className="text-caption text-text-muted mt-2">
                  Rejected on {formatDateTime(voucher.rejectedAt)} by {voucher.director?.fullName || 'Director'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h3 className="text-h2 text-text-primary mb-4 flex items-center gap-2">
              <StatusIcon className="h-5 w-5" />
              Voucher Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-caption text-text-muted">Voucher Number</p>
                <p className="font-mono font-medium text-text-primary">{voucher.voucherNumber}</p>
              </div>
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
                <p className="text-caption text-text-muted">Expense Title</p>
                <p className="font-medium text-text-primary">{voucher.expenseTitle}</p>
              </div>
              <div>
                <p className="text-caption text-text-muted">Expense Category</p>
                <p className="text-text-primary">{voucher.expenseCategory}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-caption text-text-muted">Expense Description</p>
                <p className="text-text-primary whitespace-pre-wrap">{voucher.expenseDescription || 'No description provided'}</p>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-h2 text-text-primary mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Financial Details
            </h3>
            <div className="flex items-baseline gap-4 mb-4">
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
          </Card>

          <Card>
            <h3 className="text-h2 text-text-primary mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Status Timeline
            </h3>
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border-subtle" />
              {timelineSteps.map((step, index) => {
                const isCompleted = step.completed
                const isCurrent = step.key === voucher.status || (voucher.status === 'REJECTED' && step.key === 'REJECTED') || (voucher.status === 'APPROVED' && step.key === 'APPROVED')
                const stepConfig = statusConfig[step.key as keyof typeof statusConfig]
                const StepIcon = stepConfig?.icon || FileText

                return (
                  <div key={step.key} className="relative pl-14 pb-6 last:pb-0">
                    <div className={cn(
                      'absolute left-6 w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all',
                      isCompleted ? 'bg-primary border-primary' : isCurrent ? 'bg-primary/20 border-primary' : 'bg-bg-base border-border-subtle'
                    )}>
                      {isCompleted && <StepIcon className="h-2 w-2 text-white" />}
                      {isCurrent && !isCompleted && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                    </div>
                    <div className={cn('ml-2 transition-colors', isCurrent ? 'text-text-primary' : 'text-text-secondary')}>
                      <p className="font-medium">{step.label}</p>
                      {step.date && <p className="text-caption text-text-muted">{formatDateTime(step.date)}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="sticky top-24">
            <h3 className="text-h2 text-text-primary mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Employee Information
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-medium">
                  {voucher.employee?.fullName.split(' ').map((n) => n[0]).join('').toUpperCase() || 'EU'}
                </div>
                <div>
                  <p className="font-medium text-text-primary">{voucher.employee?.fullName || 'Unknown Employee'}</p>
                  <p className="text-caption text-text-muted">{voucher.employee?.employeeId || 'N/A'}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-border-subtle space-y-2">
                <div className="flex items-center gap-2 text-caption">
                  <Building2 className="h-4 w-4 text-text-muted" />
                  <span>{voucher.employee?.department || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-caption">
                  <Calendar className="h-4 w-4 text-text-muted" />
                  <span>Submitted {voucher.submittedAt ? formatDateTime(voucher.submittedAt) : 'N/A'}</span>
                </div>
              </div>
            </div>
          </Card>

          {voucher.employeeSignatureUrl && (
            <Card className="sticky top-24">
              <h3 className="text-h2 text-text-primary mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Employee Signature
              </h3>
              <div className="bg-bg-base border border-border-subtle rounded-input p-4 min-h-[120px] flex items-center justify-center">
                <img src={voucher.employeeSignatureUrl} alt="Employee signature" className="max-w-full max-h-[100px]" />
              </div>
              <p className="text-caption text-text-muted mt-2 text-center">Digitally signed by employee</p>
            </Card>
          )}

          {voucher.directorSignatureUrl && (
            <Card className="sticky top-24">
              <h3 className="text-h2 text-text-primary mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Director Authorization
              </h3>
              <div className="bg-bg-base border border-border-subtle rounded-input p-4 min-h-[120px] flex items-center justify-center">
                <img src={voucher.directorSignatureUrl} alt="Director signature" className="max-w-full max-h-[100px]" />
              </div>
              <p className="text-caption text-text-muted mt-2 text-center">Authorized by {voucher.director?.fullName || 'Director'}</p>
              {voucher.approvedAt && (
                <p className="text-caption text-text-muted mt-1 text-center">Approved on {formatDateTime(voucher.approvedAt)}</p>
              )}
            </Card>
          )}

          {canAct && (
            <div className="sticky top-24 space-y-3">
              <Button
                variant="primary"
                onClick={() => setShowApproveModal(true)}
                disabled={!directorSignature}
                className="w-full"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Voucher
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowRejectModal(true)}
                className="w-full"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject Voucher
              </Button>
            </div>
          )}

          {!canAct && (
            <Card className="sticky top-24">
              <div className="p-4 text-center">
                <Badge variant={voucher.status.toLowerCase() as any} className="mb-2">
                  {voucher.status.replace('_', ' ')}
                </Badge>
                <p className="text-body text-text-secondary">
                  This voucher has been {voucher.status.toLowerCase().replace('_', ' ')} and cannot be modified.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Modal
        isOpen={showApproveModal}
        onClose={() => { setShowApproveModal(false); setDirectorSignature('') }}
        title="Approve Voucher"
        description="Add your digital signature to authorize this voucher"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-input">
            <p className="font-medium text-emerald-400">Voucher: {voucher.voucherNumber}</p>
            <p className="text-caption text-text-secondary mt-1">Amount: {formatCurrency(voucher.amount)}</p>
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