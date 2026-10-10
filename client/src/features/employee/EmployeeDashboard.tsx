import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus, FileText, TrendingUp, Clock, CheckCircle, XCircle, FileMinus } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { KPICard } from '@/components/data-display/KPICard'
import { Card } from '@/components/common/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/data-display/Table'
import { Badge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { PageHeader } from '@/components/layout/TopNav'
import { Skeleton, TableSkeleton } from '@/components/feedback/Skeleton'
import { EmptyVouchers } from '@/components/feedback/EmptyState'
import { demoVouchers, getDashboardKPIs, getVouchersByEmployee } from '@/data/demo-data'
import { useDemoAuth } from '@/hooks/useDemoAuth'
import type { Voucher } from '@/lib/utils'

const statusIcons = {
  DRAFT: FileMinus,
  SUBMITTED: Clock,
  PENDING_APPROVAL: Clock,
  APPROVED: CheckCircle,
  REJECTED: XCircle,
}

export function EmployeeDashboard() {
  const { user } = useDemoAuth()
  const kpis = getDashboardKPIs('EMPLOYEE', user.id)
  const userVouchers = getVouchersByEmployee(user.id)
  const recentVouchers = useMemo(() => [...userVouchers].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5), [userVouchers])

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <KPICard title="Total Vouchers" value={kpis.totalVouchers} icon={<FileText className="h-6 w-6" />} trend={{ value: 12, positive: true }} />
        <KPICard title="Draft Vouchers" value={kpis.draftVouchers} icon={<FileMinus className="h-6 w-6" />} trend={{ value: 5, positive: true }} />
        <KPICard title="Pending Approval" value={kpis.pendingApproval} icon={<Clock className="h-6 w-6" />} trend={{ value: -8, positive: false }} />
        <KPICard title="Approved" value={kpis.approvedVouchers} icon={<CheckCircle className="h-6 w-6" />} trend={{ value: 15, positive: true }} />
        <KPICard title="Rejected" value={kpis.rejectedVouchers} icon={<XCircle className="h-6 w-6" />} trend={{ value: 3, positive: false }} />
        <KPICard title="Total Amount Claimed" value={kpis.totalAmountClaimed} icon={<TrendingUp className="h-6 w-6" />} trend={{ value: 22, positive: true }} />
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-h2 text-text-primary">Recent Vouchers</h3>
          <Link to="/employee/vouchers">
            <Button variant="ghost" size="sm">View All</Button>
          </Link>
        </div>
        {recentVouchers.length === 0 ? (
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
                      <p className="text-caption text-text-muted">{voucher.department}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-caption">{formatDate(voucher.expenseDate)}</TableCell>
                  <TableCell className="font-mono tabular-nums font-medium">{formatCurrency(voucher.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={voucher.status.toLowerCase() as any}>
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

function navigate(path: string) {
  window.location.href = path
}