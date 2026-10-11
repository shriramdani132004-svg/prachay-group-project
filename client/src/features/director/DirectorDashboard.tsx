import { Link } from 'react-router-dom'
import {
  Clock,
  CheckCircle,
  XCircle,
  IndianRupee,
  Inbox,
  Activity,
  FileText,
} from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { KPICard } from '@/components/data-display/KPICard'
import { Card } from '@/components/common/Card'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/data-display/Table'
import { Badge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { PageHeader } from '@/components/layout/TopNav'
import { TableSkeleton } from '@/components/feedback/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useDirectorDashboard } from '@/hooks/useVouchers'
import { useToast } from '@/components/feedback/Toast'
import { useEffect } from 'react'
import type { ApiVoucherStatus } from '@/lib/api'

/**
 * Director Dashboard (Phase 6/7).
 *
 * Every figure is an organization-wide server aggregate: pending count and
 * pending amount come from the database, "today" counts use the server's day
 * boundary, and recent activity is the real voucher-event stream.
 */
export function DirectorDashboard() {
  const { data, isLoading, isError, error, refetch } = useDirectorDashboard()
  const { toast } = useToast()

  useEffect(() => {
    if (isError) {
      toast({
        type: 'error',
        title: 'Dashboard unavailable',
        message: error instanceof Error ? error.message : 'Please try again.',
      })
    }
  }, [isError, error, toast])

  return (
    <div className="page-container animate-fade-in">
      <PageHeader
        title="Director Dashboard"
        description="Organization-wide approval pipeline and decision activity"
        actions={
          <Link to="/director/approvals">
            <Button variant="primary">
              <Inbox className="h-4 w-4 mr-2" />
              Approval Queue
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="mb-8">
          <TableSkeleton rows={1} columns={4} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICard
            title="Pending Approval"
            value={data?.pendingApprovalCount ?? 0}
            format="count"
            icon={<Clock className="h-6 w-6" />}
          />
          <KPICard
            title="Pending Amount"
            value={Number(data?.totalPendingAmount ?? 0)}
            icon={<IndianRupee className="h-6 w-6" />}
          />
          <KPICard
            title="Approved Today"
            value={data?.approvedToday ?? 0}
            format="count"
            icon={<CheckCircle className="h-6 w-6" />}
          />
          <KPICard
            title="Rejected Today"
            value={data?.rejectedToday ?? 0}
            format="count"
            icon={<XCircle className="h-6 w-6" />}
          />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-h2 text-text-primary">Awaiting Decision</h3>
              <Link to="/director/approvals">
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </div>
            {isLoading ? (
              <TableSkeleton rows={5} columns={5} />
            ) : (data?.recentVouchers ?? []).length === 0 ? (
              <EmptyState
                icon={<CheckCircle className="h-8 w-8 text-success" />}
                title="All caught up"
                description="No vouchers are waiting for your decision."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Voucher #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.recentVouchers ?? [])
                    .filter((v) => v.status === 'PENDING_APPROVAL' || v.status === 'SUBMITTED')
                    .map((voucher) => (
                      <TableRow key={voucher.id}>
                        <TableCell className="font-mono font-medium">
                          {voucher.voucherNumber}
                        </TableCell>
                        <TableCell className="font-medium text-text-primary">
                          {voucher.expenseTitle}
                        </TableCell>
                        <TableCell className="text-text-secondary">
                          {voucher.createdByName ?? '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatCurrency(Number(voucher.amount))}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={voucher.status.toLowerCase() as Lowercase<ApiVoucherStatus>}
                          >
                            {voucher.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Link to={`/director/vouchers/${voucher.id}`}>
                            <Button variant="ghost" size="sm">
                              Review
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary" aria-hidden />
            <h3 className="text-h2 text-text-primary">Recent Activity</h3>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 rounded-input bg-bg-subtle animate-pulse" />
              ))}
            </div>
          ) : (data?.recentActivity ?? []).length === 0 ? (
            <p className="text-body text-text-muted">No workflow events yet.</p>
          ) : (
            <ul className="space-y-3" data-testid="director-activity">
              {(data?.recentActivity ?? []).map((event) => (
                <li key={event.id} className="flex items-start gap-3 text-caption">
                  <FileText className="h-4 w-4 mt-0.5 text-text-muted flex-shrink-0" aria-hidden />
                  <div>
                    <p className="text-text-primary">
                      <span className="font-medium">{event.type.replace('_', ' ')}</span>
                      {event.actorName ? ` by ${event.actorName}` : ''}
                    </p>
                    <p className="font-mono text-text-muted">
                      {event.voucherNumber} · {formatDateTime(event.createdAt)}
                    </p>
                    {event.reason && <p className="text-text-muted italic">“{event.reason}”</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
