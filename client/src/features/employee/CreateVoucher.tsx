import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { formatCurrency } from '@/lib/utils'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/forms/Input'
import { Textarea } from '@/components/forms/Input'
import { Select } from '@/components/forms/Input'
import { PageHeader } from '@/components/layout/TopNav'
import { Badge } from '@/components/common/Badge'
import { departments, expenseCategories } from '@/data/demo-data'
import { Link } from 'react-router-dom'
import { ArrowLeft, Save, Send, Trash2, AlertCircle, CheckCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const voucherSchema = z.object({
  expenseDate: z.string().min(1, 'Expense date is required'),
  department: z.string().min(1, 'Department is required'),
  expenseTitle: z.string().min(1, 'Expense title is required').max(100, 'Title must be 100 characters or less'),
  expenseCategory: z.string().min(1, 'Expense category is required'),
  expenseDescription: z.string().optional(),
  amount: z.number().min(0.01, 'Amount must be greater than zero'),
  employeeSignature: z.string().min(1, 'Employee signature is required for submission'),
})

type VoucherFormData = z.infer<typeof voucherSchema>

const departmentOptions = departments.map((d) => ({ value: d, label: d }))
const categoryOptions = expenseCategories.map((c) => ({ value: c, label: c }))

interface CreateVoucherProps {
  initialData?: Partial<VoucherFormData>
  isEdit?: boolean
  voucherId?: string
}

export function CreateVoucher({ initialData, isEdit = false, voucherId }: CreateVoucherProps) {
  const [signature, setSignature] = useState<string>('')
  const [signatureFile, setSignatureFile] = useState<File | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<VoucherFormData>({
    resolver: zodResolver(voucherSchema),
    defaultValues: {
      expenseDate: new Date().toISOString().split('T')[0],
      department: '',
      expenseTitle: '',
      expenseCategory: '',
      expenseDescription: '',
      amount: 0,
      employeeSignature: '',
      ...initialData,
    },
  })

  const amount = watch('amount')

  const onSubmit = (data: VoucherFormData, action: 'draft' | 'submit') => {
    if (action === 'submit' && !signature) {
      setValue('employeeSignature', '', { shouldValidate: true })
      return
    }
    console.log(`${action === 'draft' ? 'Save as Draft' : 'Submit for Approval'}`, { ...data, employeeSignature: signature })
    // In real app, this would call the API
  }

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('File size must be less than 2MB')
        return
      }
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        alert('Only PNG, JPEG, and WebP files are allowed')
        return
      }
      setSignatureFile(file)
      const reader = new FileReader()
      reader.onload = (event) => {
        setSignature(event.target?.result as string)
        setValue('employeeSignature', event.target?.result as string, { shouldValidate: true })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCanvasSignature = (dataUrl: string) => {
    setSignature(dataUrl)
    setValue('employeeSignature', dataUrl, { shouldValidate: true })
  }

  const canSubmit = signature.length > 0 && !errors.amount && !errors.expenseDate && !errors.department && !errors.expenseTitle && !errors.expenseCategory

  return (
    <div className="page-container animate-fade-in">
      <PageHeader
        title={isEdit ? 'Edit Voucher' : 'Create New Voucher'}
        description={isEdit ? 'Update your draft voucher details' : 'Fill in the details below to create a new expense voucher'}
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
          <form onSubmit={handleSubmit((data) => onSubmit(data, 'draft'))} className="space-y-6">
            <Card>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Expense Date"
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  error={errors.expenseDate?.message}
                  {...register('expenseDate')}
                />
                <Select
                  label="Department"
                  error={errors.department?.message}
                  options={departmentOptions}
                  placeholder="Select department"
                  {...register('department')}
                />
                <Input
                  label="Expense Title"
                  error={errors.expenseTitle?.message}
                  placeholder="e.g., Client Meeting - Mumbai"
                  maxLength={100}
                  {...register('expenseTitle')}
                />
                <Select
                  label="Expense Category"
                  error={errors.expenseCategory?.message}
                  options={categoryOptions}
                  placeholder="Select category"
                  {...register('expenseCategory')}
                />
              </div>
              <Textarea
                label="Expense Description"
                placeholder="Provide details about the expense..."
                rows={4}
                {...register('expenseDescription')}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Amount (₹)"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  error={errors.amount?.message}
                  {...register('amount', { valueAsNumber: true })}
                />
                <div className="md:col-span-2">
                  <label className="label">Voucher Date</label>
                  <Input
                    type="date"
                    value={new Date().toISOString().split('T')[0]}
                    disabled
                  />
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-h2 text-text-primary mb-4">Employee Signature</h3>
              <p className="text-body text-text-secondary mb-4">
                {isEdit ? 'Update your digital signature. This is required for submission.' : 'Draw or upload your signature. This is mandatory for submission.'}
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="label">Draw Signature</label>
                    <div className="bg-bg-base border border-border-subtle rounded-input p-4 min-h-[150px] relative">
                      {signature ? (
                        <div className="relative w-full h-full">
                          <img src={signature} alt="Signature" className="max-w-full max-h-full" />
                          <button
                            type="button"
                            onClick={() => {
                              setSignature('')
                              setSignatureFile(null)
                              setValue('employeeSignature', '', { shouldValidate: true })
                            }}
                            className="absolute top-2 right-2 btn-icon p-1.5 text-red-400 hover:text-red-300"
                            aria-label="Clear signature"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <SignaturePad onSignature={handleCanvasSignature} />
                      )}
                    </div>
                    <p className="text-caption text-text-muted mt-2">Draw your signature using mouse or touch</p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="label">Or Upload Signature Image</label>
                    <div
                      className={cn(
                        'border-2 border-dashed rounded-input p-8 text-center transition-colors',
                        signatureFile ? 'border-primary bg-primary/5' : 'border-border-subtle hover:border-primary/50'
                      )}
                      onClick={() => document.getElementById('signature-upload')?.click()}
                    >
                      <input
                        id="signature-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleSignatureUpload}
                        className="hidden"
                      />
                      <AlertCircle className="h-8 w-8 mx-auto text-text-muted mb-3" />
                      <p className="text-body text-text-secondary mb-1">
                        {signatureFile ? `Selected: ${signatureFile.name}` : 'Click to upload or drag and drop'}
                      </p>
                      <p className="text-caption text-text-muted">PNG, JPEG, WebP up to 2MB</p>
                    </div>
                  </div>
                </div>

                {signature && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-input flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="text-body font-medium text-emerald-400">Signature ready</p>
                      <p className="text-caption text-text-secondary">Your signature will be attached to this voucher</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              {isEdit && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this draft? This action cannot be undone.')) {
                      console.log('Delete draft:', voucherId)
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Draft
                </Button>
              )}
              <Button type="submit" variant="secondary">
                <Save className="h-4 w-4 mr-2" />
                Save as Draft
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => handleSubmit((data) => onSubmit(data, 'submit'))()}
                disabled={!canSubmit || isSubmitting}
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
                <span className="font-mono font-medium text-text-primary">Auto-generated on submit</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Status</span>
                <Badge variant="draft">Draft</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Amount</span>
                <span className="font-mono tabular-nums font-medium text-text-primary">{formatCurrency(amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Employee</span>
                <span className="font-medium text-text-primary">Current User</span>
              </div>
            </div>
            <div className="mt-4 p-3 bg-bg-base rounded-input border border-border-subtle">
              <p className="text-caption text-text-secondary">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                <strong>Note:</strong> Once submitted, this voucher becomes read-only and cannot be edited.
              </p>
            </div>
          </Card>

          <Card className="sticky top-24">
            <h3 className="text-h2 text-text-primary mb-4">Required Fields</h3>
            <ul className="space-y-2 text-caption text-text-secondary">
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-400" /> Department</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-400" /> Expense Title</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-400" /> Expense Date</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-400" /> Amount ({"\u003E"} ₹0)</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-400" /> Expense Category</li>
              <li className="flex items-center gap-2"><CheckCircle className={canSubmit ? 'h-4 w-4 text-emerald-400' : 'h-4 w-4 text-text-muted'} /> Employee Signature</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}

function SignaturePad({ onSignature }: { onSignature: (dataUrl: string) => void }) {
  const canvasRef = useState<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [strokes, setStrokes] = useState<{ x: number; y: number }[][]>([])

  const canvas = canvasRef[0]
  const setCanvasRef = canvasRef[1]

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvas) return
    const point = getCanvasPoint(e, canvas)
    setIsDrawing(true)
    setStrokes((prev) => [...prev, [point]])
  }

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvas || !isDrawing) return
    e.preventDefault()
    const point = getCanvasPoint(e, canvas)
    setStrokes((prev) => {
      const newStrokes = [...prev]
      newStrokes[newStrokes.length - 1].push(point)
      return newStrokes
    })
  }

  const handleEnd = () => {
    setIsDrawing(false)
  }

  const handleClear = () => {
    setStrokes([])
    onSignature('')
  }

  const handleUndo = () => {
    setStrokes((prev) => prev.slice(0, -1))
  }

  const handleConfirm = () => {
    if (canvas) {
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
          for (let i = 1; i < stroke.length; i++) {
            ctx.lineTo(stroke[i].x, stroke[i].y)
          }
          ctx.stroke()
        })

        const dataUrl = canvas.toDataURL('image/png')
        onSignature(dataUrl)
      }
    }
  }

  return (
    <div className="relative">
      <canvas
        ref={setCanvasRef}
        className="w-full h-full cursor-crosshair touch-none"
        width={600}
        height={200}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />
      {!strokes.length && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted pointer-events-none">
          <p className="text-body">Draw your signature here</p>
          <p className="text-caption">Click and drag or use touch</p>
        </div>
      )}
      <div className="absolute bottom-2 right-2 flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={handleUndo} disabled={!strokes.length}>
          Undo
        </Button>
        <Button variant="ghost" size="sm" onClick={handleClear} disabled={!strokes.length}>
          Clear
        </Button>
        <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!strokes.length}>
          Confirm
        </Button>
      </div>
    </div>
  )
}