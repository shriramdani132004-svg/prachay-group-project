import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil, Send, ArrowLeft, AlertCircle } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { PageHeader } from '@/components/layout/TopNav'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useToast } from '@/components/feedback/Toast'
import { VoucherDocument } from '@/components/documents/VoucherDocument'
import {
  useVoucher,
  useVoucherEvents,
  useSubmitVoucher,
  useUploadSignature,
} from '@/hooks/useVouchers'
import { ApiRequestError } from '@/lib/api'
import { useRef } from 'react'

/**
 * Employee voucher detail (Phases 5/8).
 *
 * Renders the persisted document via the shared VoucherDocument and offers
 * role-legal actions only: DRAFT → edit, delete-free submit (with signature).
 * Submitted/approved/rejected vouchers are read-only here.
 */
export function VoucherDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: voucher, isLoading, isError, refetch } = useVoucher(id)
  const { data: events } = useVoucherEvents(id)
  const submitMutation = useSubmitVoucher()
  const uploadMutation = useUploadSignature()

  if (isLoading) {
    return (
      <div className="page-container space-y-4">
        <Skeleton variant="text" width="280px" height="32px" />
        <Skeleton variant="rectangular" height="380px" />
      </div>
    )
  }

  if (isError || !voucher) {
    return (
      <div className="page-container">
        <Card className="text-center py-12">
          <AlertCircle className="h-8 w-8 mx-auto text-error mb-3" aria-hidden />
          <h2 className="text-h2 text-text-primary mb-2">Voucher not found</h2>
          <p className="text-body text-text-secondary mb-4">
            It may have been deleted, or you may not have access.
          </p>
          <Button variant="secondary" onClick={() => void refetch()}>
            Retry
          </Button>
        </Card>
      </div>
    )
  }

  const isDraft = voucher.status === 'DRAFT'
  const hasEmployeeSignature = voucher.signatures.some((s) => s.type === 'EMPLOYEE')

  const handleUploadClick = () => fileInputRef.current?.click()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    try {
      await uploadMutation.mutateAsync({ voucherId: id, file })
      toast({ type: 'success', title: 'Signature uploaded' })
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

  const handleSubmit = async () => {
    if (!id) return
    if (!hasEmployeeSignature) {
      toast({
        type: 'error',
        title: 'Signature required',
        message: 'Upload your signature before submitting.',
      })
      return
    }
    try {
      await submitMutation.mutateAsync(id)
      toast({ type: 'success', title: 'Submitted for approval' })
    } catch (error) {
      toast({
        type: 'error',
        title: 'Submit failed',
        message: error instanceof ApiRequestError ? error.message : undefined,
      })
    }
  }

  const actions = isDraft ? (
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
        onClick={handleUploadClick}
        disabled={uploadMutation.isPending}
        data-testid="upload-employee-signature"
      >
        {uploadMutation.isPending
          ? 'Uploading…'
          : hasEmployeeSignature
            ? 'Replace Signature'
            : 'Upload Signature'}
      </Button>
      <Link to={`/employee/vouchers/${voucher.id}/edit`}>
        <Button variant="ghost" size="sm">
          <Pencil className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </Link>
      <Button
        variant="primary"
        size="sm"
        onClick={handleSubmit}
        disabled={submitMutation.isPending || !hasEmployeeSignature}
        data-testid="submit-voucher"
      >
        <Send className="h-4 w-4 mr-1" />
        {submitMutation.isPending ? 'Submitting…' : 'Submit'}
      </Button>
    </>
  ) : null

  return (
    <div className="page-container animate-fade-in">
      <PageHeader
        title={voucher.expenseTitle}
        description={`Voucher ${voucher.voucherNumber}`}
        actions={
          <Link to="/employee/vouchers">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
        }
      />

      {!hasEmployeeSignature && isDraft && (
        <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-input flex items-center gap-2 text-caption text-warning">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden />
          No employee signature is attached yet. Upload one to enable submission.
        </div>
      )}

      <VoucherDocument voucher={voucher} events={events} actions={actions} />

      {isDraft && (
        <div className="mt-6 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/employee/vouchers')}
            data-print="hide"
          >
            Back to list
          </Button>
        </div>
      )}
    </div>
  )
}
