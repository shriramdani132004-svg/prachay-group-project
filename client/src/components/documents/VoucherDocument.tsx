import { type ReactNode } from 'react'
import { Printer } from 'lucide-react'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { Badge } from '@/components/common/Badge'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { SignatureImage } from '@/components/signatures/SignatureImage'
import type { ApiVoucherDetail, ApiVoucherStatus, ApiWorkflowEvent } from '@/lib/api'

/**
 * Document-style voucher detail (Phases 5-8).
 *
 * One shared renderer for Employee, Director and Accounts so every role sees
 * the SAME persisted facts. All values come from the server response; nothing
 * is fabricated client-side. Workflow history renders only real events.
 *
 * Print: the wrapper carries `.print-document`; buttons/controls carry
 * `data-print="hide"`; the `Print` action opens the browser print dialog
 * (print-to-PDF) against the currently rendered server data.
 */

interface VoucherDocumentProps {
  voucher: ApiVoucherDetail
  events?: ApiWorkflowEvent[]
  /** Role-specific action buttons rendered in the document header area. */
  actions?: ReactNode
  /** Extra panels (e.g. upload controls) rendered below the document. */
  children?: ReactNode
}

function InfoRow({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className={`text-body text-text-primary ${mono ? 'font-mono tabular-nums' : ''}`}>
        {value}
      </dd>
    </div>
  )
}

export function statusLabel(status: ApiVoucherStatus): string {
  return status.replace('_', ' ')
}

export function VoucherDocument({ voucher, events, actions, children }: VoucherDocumentProps) {
  const employeeSignature = voucher.signatures.find((s) => s.type === 'EMPLOYEE')
  const directorSignature = voucher.signatures.find((s) => s.type === 'DIRECTOR')

  return (
    <div className="space-y-6">
      {/* On-screen toolbar (removed in print). */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print" data-print="hide">
        <div className="flex items-center gap-3">
          <Badge variant={voucher.status.toLowerCase() as Lowercase<ApiVoucherStatus>}>
            {statusLabel(voucher.status)}
          </Badge>
          <span className="font-mono text-caption text-text-muted">{voucher.voucherNumber}</span>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            aria-label="Print voucher or save as PDF"
            data-testid="print-voucher"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print / Save as PDF
          </Button>
        </div>
      </div>

      <Card className="print-document" padding="lg">
        {/* Document header */}
        <div className="print-document-header print-avoid-break mb-6 border-b border-border-subtle pb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <h2 className="text-h1 text-text-primary">Expense Voucher</h2>
              <p className="font-mono text-body text-text-secondary">{voucher.voucherNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-caption text-text-muted">Voucher Date</p>
              <p className="font-mono text-body text-text-primary">{formatDate(voucher.voucherDate)}</p>
            </div>
          </div>
        </div>

        {/* Core facts */}
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5 mb-8 print-avoid-break">
          <InfoRow label="Employee" value={voucher.employeeNameSnapshot ?? voucher.createdByName ?? '—'} />
          <InfoRow
            label="Employee ID"
            value={voucher.employeeIdSnapshot ?? '—'}
            mono
          />
          <InfoRow label="Department" value={voucher.departmentName} />
          <InfoRow label="Expense Category" value={voucher.expenseCategoryName} />
          <InfoRow label="Expense Date" value={formatDate(voucher.expenseDate)} mono />
          <InfoRow
            label="Amount"
            value={
              <span className="font-semibold">
                {formatCurrency(Number(voucher.amount))}{' '}
                <span className="text-caption text-text-muted">{voucher.currency}</span>
              </span>
            }
            mono
          />
        </dl>

        <div className="mb-8 print-avoid-break">
          <h3 className="text-h2 text-text-primary mb-1">Expense Title</h3>
          <p className="text-body text-text-primary">{voucher.expenseTitle}</p>
        </div>

        {voucher.expenseDescription && (
          <div className="mb-8 print-avoid-break">
            <h3 className="text-h2 text-text-primary mb-1">Description</h3>
            <p className="text-body text-text-secondary whitespace-pre-wrap">
              {voucher.expenseDescription}
            </p>
          </div>
        )}

        {/* Decision metadata — only rendered when the server recorded it. */}
        {(voucher.submittedAt || voucher.approvedAt || voucher.rejectedAt) && (
          <div className="mb-8 print-avoid-break border-t border-border-subtle pt-5">
            <h3 className="text-h2 text-text-primary mb-3">Workflow</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
              {voucher.submittedAt && (
                <InfoRow label="Submitted" value={formatDateTime(voucher.submittedAt)} />
              )}
              {voucher.approvedAt && (
                <InfoRow label="Approved" value={formatDateTime(voucher.approvedAt)} />
              )}
              {voucher.approvedAt && voucher.reviewedByName && (
                <InfoRow label="Reviewed By" value={voucher.reviewedByName} />
              )}
              {voucher.rejectedAt && (
                <InfoRow label="Rejected" value={formatDateTime(voucher.rejectedAt)} />
              )}
              {voucher.rejectionReason && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <dt className="text-caption text-text-muted">Rejection Reason</dt>
                  <dd className="text-body text-text-primary whitespace-pre-wrap">
                    {voucher.rejectionReason}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Signatures */}
        <div className="print-signature-block border-t border-border-subtle pt-6">
          <h3 className="text-h2 text-text-primary mb-4">Signatures</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div>
              <p className="text-caption text-text-muted mb-2">Employee Signature</p>
              {employeeSignature ? (
                <SignatureImage
                  signatureId={employeeSignature.id}
                  alt={`Employee signature of ${voucher.employeeNameSnapshot ?? 'employee'}`}
                  className="h-24 w-64"
                />
              ) : (
                <p className="text-body text-text-muted italic">Not signed</p>
              )}
              <p className="mt-2 text-caption text-text-secondary">
                {voucher.employeeNameSnapshot ?? voucher.createdByName ?? '—'}
                {voucher.employeeIdSnapshot ? ` · ${voucher.employeeIdSnapshot}` : ''}
              </p>
            </div>

            <div>
              <p className="text-caption text-text-muted mb-2">Director Signature</p>
              {directorSignature ? (
                <SignatureImage
                  signatureId={directorSignature.id}
                  alt={`Director signature of ${voucher.reviewedByName ?? 'director'}`}
                  className="h-24 w-64"
                />
              ) : (
                <p className="text-body text-text-muted italic">
                  {voucher.status === 'APPROVED' || voucher.status === 'REJECTED'
                    ? 'Not signed'
                    : 'Pending review'}
                </p>
              )}
              {voucher.reviewedByName && (
                <p className="mt-2 text-caption text-text-secondary">{voucher.reviewedByName}</p>
              )}
            </div>
          </div>
        </div>

        {/* Real workflow history only — no fabricated events. */}
        {events && events.length > 0 && (
          <div className="mt-8 border-t border-border-subtle pt-5 print-avoid-break">
            <h3 className="text-h2 text-text-primary mb-3">Workflow History</h3>
            <ol className="space-y-2" data-testid="workflow-history">
              {events.map((event) => (
                <li key={event.id} className="flex flex-wrap items-baseline gap-x-3 text-caption">
                  <span className="font-mono text-text-muted">{formatDateTime(event.createdAt)}</span>
                  <span className="font-medium text-text-primary">{event.type.replace('_', ' ')}</span>
                  {event.actorName && (
                    <span className="text-text-secondary">by {event.actorName}</span>
                  )}
                  {event.reason && (
                    <span className="text-text-muted italic">“{event.reason}”</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </Card>

      {children}
    </div>
  )
}
