import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle, XCircle, Upload } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { Textarea } from '@/components/forms/Input'
import { Modal, ConfirmDialog } from '@/components/overlays/Modal'
import { PageHeader } from '@/components/layout/TopNav'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useToast } from '@/components/feedback/Toast'
import { VoucherDocument } from '@/components/documents/VoucherDocument'
import { SignaturePad } from '@/components/signatures/SignaturePad'
import {
  useVoucher,
  useVoucherEvents,
  useApproveVoucher,
  useRejectVoucher,
  useUploadSignature,
} from '@/hooks/useVouchers'
import { ApiRequestError } from '@/lib/api'

/**
 * Director review (Phase 6/8).
 *
 * Decision rules enforced server-side and surfaced here:
 * - Only PENDING_APPROVAL vouchers are decidable (else 409).
 * - A DIRECTOR signature must exist on the voucher before approve/reject
 *   succeeds (else 422) — upload it here.
 * - Reject requires a validated reason.
 * - Concurrent decisions resolve to exactly one winner (conditional update).
 */
export function VoucherReview() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: voucher, isLoading, isError, refetch } = useVoucher(id)
  const { data: events } = useVoucherEvents(id)
  const approveMutation = useApproveVoucher()
  const rejectMutation = useRejectVoucher()
  const uploadMutation = useUploadSignature()

  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')

  if (isLoading) {
    return (
      <div className="page-container space-y-4">
        <Skeleton variant="text" width="280px" height="32px" />
        <Skeleton variant="rectangular" height="400px" />
      </div>
    )
  }

  if (isError || !voucher) {
    return (
      <div className="page-container">
        <Card className="text-center py-12">
          <h2 className="text-h2 text-text-primary mb-2">Voucher not found</h2>
          <Button variant="secondary" onClick={() => void refetch()}>
            Retry
          </Button>
        </Card>
      </div>
    )
  }

  const isPending = voucher.status === 'PENDING_APPROVAL'
  const hasDirectorSignature = voucher.signatures.some((s) => s.type === 'DIRECTOR')
  const hasEmployeeSignature = voucher.signatures.some((s) => s.type === 'EMPLOYEE')

  const handleUploadDirectorSignature = () => fileInputRef.current?.click()

  const handlePadCapture = async (file: File) => {
    if (!id) return
    try {
      await uploadMutation.mutateAsync({ voucherId: id, file })
      toast({ type: 'success', title: 'Director signature saved' })
    } catch {
      toast({ type: 'error', title: 'Upload failed', message: 'Could not save the drawn signature.' })
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    try {
      await uploadMutation.mutateAsync({ voucherId: id, file })
      toast({ type: 'success', title: 'Director signature saved' })
    } catch (error) {
      toast({
        type: 'error',
        title: 'Upload failed',
        message: error instanceof Error ? error.message : undefined,
      })
    } finally {
      e.target.value = ''
    }
  }

  const handleApprove = async () => {
    if (!id) return
    try {
      await approveMutation.mutateAsync(id)
      setApproveOpen(false)
      toast({ type: 'success', title: 'Voucher approved' })
    } catch (error) {
      setApproveOpen(false)
      toast({
        type: 'error',
        title: 'Approval failed',
        message: error instanceof ApiRequestError ? error.message : undefined,
      })
    }
  }

  const handleReject = async () => {
    if (!id) return
    const trimmed = rejectReason.trim()
    if (trimmed.length < 10) {
      setRejectError('Please provide a reason of at least 10 characters.')
      return
    }
    setRejectError('')
    try {
      await rejectMutation.mutateAsync({ id, reason: trimmed })
      setRejectOpen(false)
      setRejectReason('')
      toast({ type: 'success', title: 'Voucher rejected' })
    } catch (error) {
      setRejectOpen(false)
      toast({
        type: 'error',
        title: 'Rejection failed',
        message: error instanceof ApiRequestError ? error.message : undefined,
      })
    }
  }

  const actions = isPending ? (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden
        tabIndex={-1}
      />
      <Button
        variant="secondary"
        size="sm"
        onClick={handleUploadDirectorSignature}
        disabled={uploadMutation.isPending}
        data-testid="upload-director-signature"
      >
        <Upload className="h-4 w-4 mr-1" />
        {uploadMutation.isPending
          ? 'Uploading…'
          : hasDirectorSignature
            ? 'Replace Director Signature'
            : 'Upload Director Signature'}
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setRejectOpen(true)}
        data-testid="reject-voucher"
      >
        <XCircle className="h-4 w-4 mr-1" />
        Reject
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={() => setApproveOpen(true)}
        disabled={!hasDirectorSignature}
        data-testid="approve-voucher"
        title={
          hasDirectorSignature
            ? undefined
            : 'Upload your Director signature before approving.'
        }
      >
        <CheckCircle className="h-4 w-4 mr-1" />
        Approve
      </Button>
    </>
  ) : null

  return (
    <div className="page-container animate-fade-in">
      <PageHeader
        title="Review Voucher"
        description={`${voucher.voucherNumber} · ${voucher.expenseTitle}`}
        actions={
          <Link to="/director/approvals">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Queue
            </Button>
          </Link>
        }
      />

      {isPending && !hasDirectorSignature && (
        <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-input text-caption text-warning">
          Your Director signature is required before you can approve. Draw one below, or use
          “Upload Director Signature” in the toolbar.
        </div>
      )}

      {isPending && !hasEmployeeSignature && (
        <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded-input text-caption text-error">
          The employee signature is missing on this voucher. You may still reject it with a reason.
        </div>
      )}

      <VoucherDocument voucher={voucher} events={events} actions={actions}>
        {isPending && !hasDirectorSignature ? (
          <Card className="no-print" data-print="hide">
            <h3 className="text-h2 text-text-primary mb-2">Director Signature</h3>
            <p className="text-body text-text-secondary mb-4">
              Draw your signature below, or upload an image from the toolbar. A signature is
              required before approving.
            </p>
            <SignaturePad disabled={uploadMutation.isPending} onCapture={handlePadCapture} />
          </Card>
        ) : null}
      </VoucherDocument>

      {/* Approve confirmation */}
      <Modal
        isOpen={approveOpen}
        onClose={() => setApproveOpen(false)}
        title="Approve voucher"
        description={`You are approving ${voucher.voucherNumber} for ${voucher.amount} ${voucher.currency}. This decision is final.`}
        size="sm"
      >
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="ghost" onClick={() => setApproveOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleApprove}
            loading={approveMutation.isPending}
            data-testid="confirm-approve"
          >
            Confirm Approval
          </Button>
        </div>
      </Modal>

      {/* Reject with reason */}
      <ConfirmDialog
        isOpen={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={handleReject}
        title="Reject voucher"
        message={`Provide a clear reason for rejecting ${voucher.voucherNumber}. The employee will see this reason.`}
        confirmText="Reject Voucher"
        variant="destructive"
        loading={rejectMutation.isPending}
      >
        <Textarea
          label="Rejection reason"
          value={rejectReason}
          onChange={(e) => {
            setRejectReason(e.target.value)
            if (rejectError) setRejectError('')
          }}
          rows={3}
          placeholder="e.g., Amount does not match the attached invoice lines."
          error={rejectError}
          aria-label="Rejection reason"
        />
      </ConfirmDialog>
    </div>
  )
}
