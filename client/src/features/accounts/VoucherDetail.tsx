import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { PageHeader } from '@/components/layout/TopNav'
import { Skeleton } from '@/components/feedback/Skeleton'
import { VoucherDocument } from '@/components/documents/VoucherDocument'
import { useVoucher, useVoucherEvents } from '@/hooks/useVouchers'

/**
 * Accounts voucher detail (Phase 7/8).
 *
 * Organization-wide READ-ONLY view. Renders the same persisted document as
 * Employee and Director via the shared VoucherDocument (which carries the
 * Print/Save-as-PDF action). Accounts never see mutation controls here by
 * policy (no approve/reject/edit/upload).
 */
export function AccountsVoucherDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: voucher, isLoading, isError, refetch } = useVoucher(id)
  const { data: events } = useVoucherEvents(id)

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

  return (
    <div className="page-container animate-fade-in">
      <PageHeader
        title={voucher.expenseTitle}
        description={`Voucher ${voucher.voucherNumber}`}
        breadcrumbs={[
          { label: 'Dashboard', path: '/accounts' },
          { label: 'Voucher Register', path: '/accounts/vouchers' },
          { label: voucher.voucherNumber },
        ]}
        actions={
          <Link to="/accounts/vouchers">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
        }
      />

      <VoucherDocument voucher={voucher} events={events} />
    </div>
  )
}
