import { Link } from 'react-router-dom'
import { Clock, CheckCircle, XCircle, DollarSign, TrendingUp, FileText, ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { KPICard } from '@/components/data-display/KPICard'
import { Card } from '@/components/common/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/data-display/Table'
import { Badge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { PageHeader } from '@/components/layout/TopNav'
import { Skeleton } from '@/components/feedback/Skeleton'
import { getDashboardKPIs, demoVouchers } from '@/data/demo-data'
import { useDemoAuth } from '@/hooks/useDemoAuth'
import { cn } from '@/lib/utils'

export function DirectorDashboard() {
  const { user } = useDemoAuth()
  const kpis = getDashboardKPIs('DIRECTOR')
  const pendingVouchers = demoVouchers.filter((v) => v.status === 'SUBMITTED' || v.status === 'PENDING_APPROVAL').slice(0, 5)

  return (
    <div className="page-container animate-fade-in">
      <PageHeader
        title="Director Dashboard"
        description={`Welcome, ${user.fullName.split(' ')[0]}. Review pending approvals and monitor organizational spending.`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <KPICard
          title="Pending Approvals"
          value={kpis.pendingApprovalCount || 0}
          icon={<Clock className="h-6 w-6" />}
          trend={{ value: 15, positive: false }}
        />
        <KPICard
          title="Approved Today"
          value={kpis.approvedToday || 0}
          icon={<CheckCircle className="h-6 w-6" />}
          trend={{ value: 8, positive: true }}
        />
        <KPICard
          title="Rejected Today"
          value={kpis.rejectedToday || 0}
          icon={<XCircle className="h-6 w-6" />}
          trend={{ value: 2, positive: false }}
        />
        <KPICard
          title="Total Pending Amount"
          value={kpis.totalPendingAmount || 0}
          icon={<DollarSign className="h-6 w-6" />}
          trend={{ value: 12, positive: false }}
        />
        <KPICard
          title="Total Vouchers"
          value={kpis.totalVouchers}
          icon={<FileText className="h-6 w-6" />}
          trend={{ value: 5, positive: true }}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-h2 text-text-primary">Urgent Action Queue</h3>
            <Link to="/director/approvals">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </div>
          {pendingVouchers.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto text-text-muted mb-4" />
              <p className="text-body text-text-secondary">No pending approvals</p>
              <p className="text-caption text-text-muted">All caught up!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingVouchers.map((voucher) => (
                <Link key={voucher.id} to={`/director/vouchers/${voucher.id}`} className="block">
                  <div className={cn('card-hover p-4 flex items-center justify-between')}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="font-medium text-text-primary">{voucher.expenseTitle}</p>
                        <p className="text-caption text-text-muted">{voucher.employee?.fullName} • {voucher.department}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono tabular-nums font-medium text-text-primary">{formatCurrency(voucher.amount)}</p>
                      <Badge variant={voucher.status.toLowerCase() as any} className="mt-1">
                        {voucher.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-h2 text-text-primary mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {[
              { action: 'Approved', voucher: 'VCH-20261001-0001', employee: 'Rajesh Kumar', amount: 45000, time: '2 hours ago', type: 'approved' },
              { action: 'Submitted', voucher: 'VCH-20261003-0002', employee: 'Priya Sharma', amount: 125000, time: '4 hours ago', type: 'submitted' },
              { action: 'Rejected', voucher: 'VCH-20261005-0003', employee: 'Arun Patel', amount: 75000, time: '1 day ago', type: 'rejected' },
              { action: 'Approved', voucher: 'VCH-20261009-0006', employee: 'Arun Patel', amount: 210000, time: '2 days ago', type: 'approved' },
            ].map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-bg-base rounded-button hover:bg-border-subtle/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    activity.type === 'approved' && 'bg-emerald-500/10 text-emerald-400',
                    activity.type === 'rejected' && 'bg-rose-500/10 text-rose-400',
                    activity.type === 'submitted' && 'bg-blue-500/10 text-blue-400'
                  )}>
                    {activity.type === 'approved' && <CheckCircle className="h-4 w-4" />}
                    {activity.type === 'rejected' && <XCircle className="h-4 w-4" />}
                    {activity.type === 'submitted' && <FileText className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">{activity.action} <span className="font-mono">{activity.voucher}</span></p>
                    <p className="text-caption text-text-muted">{activity.employee} • {formatCurrency(activity.amount)}</p>
                  </div>
                </div>
                <span className="text-caption text-text-muted">{activity.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}