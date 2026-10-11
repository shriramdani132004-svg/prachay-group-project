import { useState, useRef, useEffect, useCallback } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { formatCurrency } from '@/lib/utils'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Input, Textarea, Select } from '@/components/forms/Input'
import { PageHeader } from '@/components/layout/TopNav'
import { Badge } from '@/components/common/Badge'
import { useToast } from '@/components/feedback/Toast'
import { Skeleton } from '@/components/feedback/Skeleton'
import {
  useCreateVoucher,
  useUpdateVoucher,
  useDeleteVoucher,
  useSubmitVoucher,
  useUploadSignature,
  useVoucher,
  useDepartments,
  useExpenseCategories,
} from '@/hooks/useVouchers'
import { ApiRequestError } from '@/lib/api'
import { SignaturePad } from '@/components/signatures/SignaturePad'
import { ArrowLeft, Save, Send, Trash2, AlertCircle, CheckCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const TODAY = new Date().toISOString().split('T')[0]

const voucherSchema = z.object({
  expenseDate: z.string().min(1, 'Expense date is required'),
  departmentId: z.string().min(1, 'Department is required'),
  expenseTitle: z
    .string()
    .min(1, 'Expense title is required')
    .max(160, 'Title must be 160 characters or less'),
  expenseCategoryId: z.string().min(1, 'Expense category is required'),
  expenseDescription: z.string().max(4000).optional(),
  amount: z
    .number({ invalid_type_error: 'Amount is required' })
    .positive('Amount must be greater than zero')
    .refine((n) => Math.round(n * 100) === n * 100 || true, 'Max two decimal places'),
})

type VoucherFormData = z.infer<typeof voucherSchema>

interface CreateVoucherProps {
  isEdit?: boolean
}

export function CreateVoucher({ isEdit = false }: CreateVoucherProps) {
  const { id: voucherId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [signaturePreview, setSignaturePreview] = useState<string>('')
  const [signatureFile, setSignatureFile] = useState<File | null>(null)
  const [signatureError, setSignatureError] = useState<string>('')

  const createMutation = useCreateVoucher()
  const updateMutation = useUpdateVoucher()
  const deleteMutation = useDeleteVoucher()
  const submitMutation = useSubmitVoucher()
  const uploadMutation = useUploadSignature()

  const { data: existing, isLoading: loadingExisting } = useVoucher(isEdit ? voucherId : undefined)
  const { data: departments } = useDepartments()
  const { data: categories } = useExpenseCategories()

  const existingEmployeeSignature = existing?.signatures.find((s) => s.type === 'EMPLOYEE')

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<VoucherFormData>({
    resolver: zodResolver(voucherSchema),
    defaultValues: {
      expenseDate: TODAY,
      departmentId: '',
      expenseTitle: '',
      expenseCategoryId: '',
      expenseDescription: '',
      amount: 0,
    },
  })

  // Hydrate the form from the persisted draft once it arrives.
  useEffect(() => {
    if (existing) {
      reset({
        expenseDate: existing.expenseDate,
        departmentId: existing.departmentId,
        expenseTitle: existing.expenseTitle,
        expenseCategoryId: existing.expenseCategoryId,
        expenseDescription: existing.expenseDescription ?? '',
        amount: Number(existing.amount),
      })
    }
  }, [existing, reset])

  const amount = useWatch({ control, name: 'amount' })

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSignatureError('')
    if (file.size > 2 * 1024 * 1024) {
      setSignatureError('File size must be 2MB or less.')
      return
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setSignatureError('Only PNG, JPEG and WebP files are allowed.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setSignaturePreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)
    setSignatureFile(file)
  }

  const clearSignature = () => {
    setSignaturePreview('')
    setSignatureFile(null)
    setSignatureError('')
  }

  const toBody = (data: VoucherFormData) => ({
    departmentId: data.departmentId,
    expenseTitle: data.expenseTitle,
    expenseCategoryId: data.expenseCategoryId,
    expenseDate: data.expenseDate,
    amount: data.amount,
    ...(data.expenseDescription ? { expenseDescription: data.expenseDescription } : {}),
  })

  const persistSignature = async (targetVoucherId: string, file: File) => {
    await uploadMutation.mutateAsync({ voucherId: targetVoucherId, file })
  }

  const onSubmit = async (data: VoucherFormData, action: 'draft' | 'submit') => {
    try {
      let targetId = voucherId

      if (isEdit && voucherId) {
        await updateMutation.mutateAsync({ id: voucherId, body: toBody(data) })
      } else {
        const created = await createMutation.mutateAsync(toBody(data))
        targetId = created.id
      }

      if (signatureFile && targetId) {
        await persistSignature(targetId, signatureFile)
      }

      if (action === 'submit' && targetId) {
        if (!signatureFile && !existingEmployeeSignature) {
          toast({
            type: 'error',
            title: 'Signature required',
            message: 'Upload your signature before submitting.',
          })
          return
        }
        await submitMutation.mutateAsync(targetId)
        toast({
          type: 'success',
          title: 'Voucher submitted',
          message: 'Your voucher is now pending director approval.',
        })
        navigate(`/employee/vouchers/${targetId}`)
      } else {
        toast({
          type: 'success',
          title: isEdit ? 'Draft updated' : 'Draft saved',
          message: signatureFile ? 'Signature uploaded.' : undefined,
        })
        navigate(targetId ? `/employee/vouchers/${targetId}` : '/employee/vouchers')
      }
    } catch (error) {
      const message =
        error instanceof ApiRequestError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Something went wrong.'
      toast({ type: 'error', title: 'Save failed', message })
    }
  }

  const handleDelete = async () => {
    if (!voucherId) return
    if (!window.confirm('Delete this draft? This cannot be undone.')) return
    try {
      await deleteMutation.mutateAsync(voucherId)
      toast({ type: 'success', title: 'Draft deleted' })
      navigate('/employee/vouchers')
    } catch (error) {
      toast({
        type: 'error',
        title: 'Delete failed',
        message: error instanceof Error ? error.message : undefined,
      })
    }
  }

  if (isEdit && loadingExisting) {
    return (
      <div className="page-container space-y-4">
        <Skeleton variant="text" width="240px" height="32px" />
        <Skeleton variant="rectangular" height="320px" />
        <Skeleton variant="rectangular" height="180px" />
      </div>
    )
  }

  if (isEdit && existing && existing.status !== 'DRAFT') {
    return (
      <div className="page-container">
        <Card className="text-center py-12">
          <AlertCircle className="h-8 w-8 mx-auto text-warning mb-3" aria-hidden />
          <h2 className="text-h2 text-text-primary mb-2">Not editable</h2>
          <p className="text-body text-text-secondary mb-4">
            This voucher is {existing.status.replace('_', ' ').toLowerCase()} and can no longer be
            edited.
          </p>
          <Link to={`/employee/vouchers/${existing.id}`}>
            <Button variant="secondary">View voucher</Button>
          </Link>
        </Card>
      </div>
    )
  }

  const departmentOptions = (departments ?? []).map((d) => ({ value: d.id, label: d.name }))
  const categoryOptions = (categories ?? []).map((c) => ({ value: c.id, label: c.name }))

  const busy = isSubmitting || createMutation.isPending || updateMutation.isPending || submitMutation.isPending

  return (
    <div className="page-container animate-fade-in">
      <PageHeader
        title={isEdit ? 'Edit Draft Voucher' : 'Create New Voucher'}
        description={
          isEdit
            ? 'Update your draft before submitting it for approval'
            : 'Fill in the details below to create a new expense voucher'
        }
        actions={
          <Link to="/employee/vouchers">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Vouchers
            </Button>
          </Link>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <form
            onSubmit={handleSubmit((data) => onSubmit(data, 'draft'))}
            className="space-y-6"
            noValidate
          >
            <Card>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Expense Date"
                  type="date"
                  max={TODAY}
                  error={errors.expenseDate?.message}
                  {...register('expenseDate')}
                />
                <Select
                  label="Department"
                  error={errors.departmentId?.message}
                  options={departmentOptions}
                  placeholder="Select department"
                  {...register('departmentId')}
                />
                <Input
                  label="Expense Title"
                  error={errors.expenseTitle?.message}
                  placeholder="e.g., Client Meeting - Mumbai"
                  maxLength={160}
                  {...register('expenseTitle')}
                />
                <Select
                  label="Expense Category"
                  error={errors.expenseCategoryId?.message}
                  options={categoryOptions}
                  placeholder="Select category"
                  {...register('expenseCategoryId')}
                />
              </div>
              <Textarea
                label="Expense Description"
                placeholder="Provide details about the expense..."
                rows={4}
                {...register('expenseDescription')}
              />
              <Input
                label="Amount (₹)"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                error={errors.amount?.message}
                {...register('amount', { valueAsNumber: true })}
              />
            </Card>

            <Card>
              <h3 className="text-h2 text-text-primary mb-2">Employee Signature</h3>
              <p className="text-body text-text-secondary mb-4">
                Draw your signature below, or upload an image. This is required before submission.
              </p>

              {existingEmployeeSignature && !signaturePreview && (
                <div className="mb-4 p-3 bg-success/10 border border-success/30 rounded-input text-caption text-success">
                  <CheckCircle className="h-4 w-4 inline mr-1" aria-hidden />
                  A signature is already saved on this voucher. Draw or upload a new one to replace
                  it.
                </div>
              )}

              {!signaturePreview && (
                <div className="mb-4">
                  <SignaturePad
                    disabled={busy}
                    onCapture={(file, preview) => {
                      setSignatureError('')
                      setSignaturePreview(preview)
                      setSignatureFile(file)
                    }}
                  />
                  <p className="mt-2 text-caption text-text-muted">
                    Or upload an image instead:
                  </p>
                </div>
              )}

              <div
                className={cn(
                  'border-2 border-dashed rounded-input p-8 text-center transition-colors cursor-pointer',
                  signaturePreview
                    ? 'border-success bg-success/5'
                    : 'border-border-subtle hover:border-primary/50',
                )}
                onClick={() => document.getElementById('signature-upload')?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    document.getElementById('signature-upload')?.click()
                  }
                }}
                aria-label="Upload signature image"
              >
                <input
                  id="signature-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleSignatureUpload}
                  className="hidden"
                />
                {signaturePreview ? (
                  <div className="relative inline-block">
                    <img
                      src={signaturePreview}
                      alt="Signature preview"
                      className="mx-auto max-h-28 rounded-input bg-white"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        clearSignature()
                      }}
                      className="absolute -top-2 -right-2 btn-icon p-1 bg-error text-white rounded-full"
                      aria-label="Remove signature"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <AlertCircle className="h-8 w-8 mx-auto text-text-muted mb-3" aria-hidden />
                    <p className="text-body text-text-secondary mb-1">
                      Click to upload a signature image
                    </p>
                    <p className="text-caption text-text-muted">PNG, JPEG or WebP, up to 2MB</p>
                  </>
                )}
              </div>

              {signatureError && (
                <p className="mt-2 text-caption text-error" role="alert">
                  {signatureError}
                </p>
              )}
            </Card>

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              {isEdit && voucherId && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending || busy}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Draft
                </Button>
              )}
              <Button type="submit" variant="secondary" disabled={busy}>
                <Save className="h-4 w-4 mr-2" />
                Save as Draft
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSubmit((data) => onSubmit(data, 'submit'))}
                disabled={busy}
              >
                <Send className="h-4 w-4 mr-2" />
                Submit for Approval
              </Button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <Card className="sticky top-24">
            <h3 className="text-h2 text-text-primary mb-4">Voucher Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Voucher Number</span>
                <span className="font-mono font-medium text-text-primary">
                  {existing?.voucherNumber ?? 'Assigned on creation'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Status</span>
                <Badge variant={existing?.status === 'DRAFT' ? 'draft' : 'default'}>
                  {existing?.status.replace('_', ' ') ?? 'Draft'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Amount</span>
                <span className="font-mono tabular-nums font-medium text-text-primary">
                  {formatCurrency(amount || 0)}
                </span>
              </div>
            </div>
            <div className="mt-4 p-3 bg-bg-base rounded-input border border-border-subtle">
              <p className="text-caption text-text-secondary">
                <AlertCircle className="h-4 w-4 inline mr-1" aria-hidden />
                <strong>Note:</strong> Once submitted, this voucher becomes read-only and cannot be
                edited.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
