import { Link, useNavigate } from 'react-router-dom'
import { Plus, FileText, TrendingUp, Clock, CheckCircle, XCircle, FileMinus } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
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
import { EmptyVouchers } from '@/components/feedback/EmptyState'
import { TableSkeleton } from '@/components/feedback/Skeleton'
import { useEmployeeDashboard } from '@/hooks/useVouchers'
import { useAuthenticatedUser } from '@/hooks/useAuth'
import type { ApiVoucherStatus } from '@/lib/api'

export function EmployeeDashboard() {
  const user = useAuthenticatedUser()
  const navigate = useNavigate()
  const { data, isLoading } = useEmployeeDashboard()

  const recentVouchers = data?.recentVouchers ?? []

  return (
    <div className="page-container animate-fade-in">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user.fullName.split(' ')[0]}. Here's an overview of your vouchers.`}
        actions={
          <Link to="/employee/vouchers/new">
            <Button variant="primary">
              <Plus className="h-4 w-4" />
              Create Voucher
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="mb-8">
          <TableSkeleton rows={1} columns={6} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4 mb-8">
          <KPICard
            title="Total Vouchers"
            value={data?.totalVouchers ?? 0}
            format="count"
            icon={<FileText className="h-6 w-6" />}
          />
          <KPICard
            title="Draft Vouchers"
            value={data?.draftVouchers ?? 0}
            format="count"
            icon={<FileMinus className="h-6 w-6" />}
          />
          <KPICard
            title="Pending Approval"
            value={data?.pendingApproval ?? 0}
            format="count"
            icon={<Clock className="h-6 w-6" />}
          />
          <KPICard
            title="Approved"
            value={data?.approvedVouchers ?? 0}
            format="count"
            icon={<CheckCircle className="h-6 w-6" />}
          />
          <KPICard
            title="Rejected"
            value={data?.rejectedVouchers ?? 0}
            format="count"
            icon={<XCircle className="h-6 w-6" />}
          />
          <KPICard
            title="Total Amount Claimed"
            value={Number(data?.totalAmountClaimed ?? 0)}
            icon={<TrendingUp className="h-6 w-6" />}
          />
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-h2 text-text-primary">Recent Vouchers</h3>
          <Link to="/employee/vouchers">
            <Button variant="ghost" size="sm">
              View All
            </Button>
          </Link>
        </div>
        {isLoading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : recentVouchers.length === 0 ? (
          <EmptyVouchers onCreate={() => navigate('/employee/vouchers/new')} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voucher #</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentVouchers.map((voucher) => (
                <TableRow key={voucher.id}>
                  <TableCell className="font-mono font-medium">{voucher.voucherNumber}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-text-primary">{voucher.expenseTitle}</p>
                      <p className="text-caption text-text-muted">{voucher.departmentName}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-caption">
                    {formatDate(voucher.expenseDate)}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums font-medium">
                    {formatCurrency(Number(voucher.amount))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={voucher.status.toLowerCase() as Lowercase<ApiVoucherStatus>}>
                      {voucher.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link to={`/employee/vouchers/${voucher.id}`}>
                        <Button variant="ghost" size="icon" aria-label="View details">
                          <FileText className="h-4 w-4" />
                        </Button>
                      </Link>
                      {voucher.status === 'DRAFT' && (
                        <Link to={`/employee/vouchers/${voucher.id}/edit`}>
                          <Button variant="ghost" size="icon" aria-label="Edit draft">
                            <FileText className="h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
