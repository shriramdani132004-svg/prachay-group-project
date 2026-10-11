import { Link } from 'react-router-dom'
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  IndianRupee,
  Activity,
} from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { KPICard } from '@/components/data-display/KPICard'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { PageHeader } from '@/components/layout/TopNav'
import { TableSkeleton } from '@/components/feedback/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useAccountsDashboard, useAnalyticsTrends, useActivity } from '@/hooks/useVouchers'
import { useToast } from '@/components/feedback/Toast'
import { useEffect } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

/**
 * Accounts Dashboard (Phase 7).
 *
 * Every figure is an organization-wide server aggregate from
 * GET /api/v1/vouchers/accounts/dashboard. The spending trend comes from the
 * real analytics endpoint (SUM by NUMERIC in PostgreSQL), never from client
 * arithmetic over demo fixtures.
 */
export function AccountsDashboard() {
  const { data, isLoading, isError, error } = useAccountsDashboard()
  const trend = useAnalyticsTrends({ granularity: 'month' })
  const activity = useActivity(10)
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

  const chartData = (trend.data?.points ?? []).map((point) => ({
    month: point.period,
    amount: Number(point.totalAmount),
  }))

  return (
    <div className="page-container animate-fade-in">
      <PageHeader
        title="Accounts Dashboard"
        description="Organization-wide reimbursement pipeline and spending analytics"
        actions={
          <Link to="/accounts/vouchers">
            <Button variant="primary">
              <FileText className="h-4 w-4 mr-2" />
              Voucher Register
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="mb-8">
          <TableSkeleton rows={1} columns={5} />
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
            title="Pending Approval"
            value={data?.pendingApprovalCount ?? 0}
            format="count"
            icon={<Clock className="h-6 w-6" />}
          />
          <KPICard
            title="Approved Vouchers"
            value={data?.approvedCount ?? 0}
            format="count"
            icon={<CheckCircle className="h-6 w-6" />}
          />
          <KPICard
            title="Rejected Vouchers"
            value={data?.rejectedCount ?? 0}
            format="count"
            icon={<XCircle className="h-6 w-6" />}
          />
          <KPICard
            title="Total Approved Amount"
            value={Number(data?.totalApprovedExpenseAmount ?? 0)}
            icon={<IndianRupee className="h-6 w-6" />}
          />
          <KPICard
            title="Recent Approved"
            value={(data?.recentApprovedVouchers ?? []).length}
            format="count"
            icon={<Activity className="h-6 w-6" />}
          />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="lg:col-span-2">
          <h3 className="text-h2 text-text-primary mb-4">Monthly Spending Trend</h3>
          {trend.isLoading ? (
            <div className="h-72 rounded-input bg-bg-subtle animate-pulse" />
          ) : chartData.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-8 w-8 text-text-muted" />}
              title="No spending data yet"
              description="The trend will appear once vouchers have expense dates in the last 12 months."
            />
          ) : (
            <div className="h-72" data-testid="accounts-trend-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis
                    dataKey="month"
                    stroke="#64748B"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#64748B"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1E293B',
                      border: '1px solid #1E293B',
                      borderRadius: '8px',
                      color: '#F8FAFC',
                    }}
                    formatter={(value: any) => [
                      formatCurrency(typeof value === 'number' ? value : 0),
                      'Total Amount',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#10B981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorApproved)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-h2 text-text-primary">Recent Approved Vouchers</h3>
            <Link to="/accounts/vouchers?status=APPROVED">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </div>
          {(data?.recentApprovedVouchers ?? []).length === 0 ? (
            <EmptyState
              icon={<CheckCircle className="h-8 w-8 text-success" />}
              title="No approved vouchers yet"
              description="Approved vouchers will appear here once the Director approves them."
            />
          ) : (
            <div className="space-y-3">
              {(data?.recentApprovedVouchers ?? []).map((voucher) => (
                <Link
                  key={voucher.id}
                  to={`/accounts/vouchers/${voucher.id}`}
                  className="flex items-center justify-between p-3 bg-bg-base rounded-button hover:bg-border-subtle/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">{voucher.voucherNumber}</p>
                      <p className="text-caption text-text-muted">
                        {voucher.createdByName ?? '—'} • {voucher.departmentName}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono tabular-nums font-medium text-text-primary">
                      {formatCurrency(Number(voucher.amount))}
                    </p>
                    <Badge variant="approved">Approved</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary" aria-hidden />
            <h3 className="text-h2 text-text-primary">Recent Activity</h3>
          </div>
          {activity.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 rounded-input bg-bg-subtle animate-pulse" />
              ))}
            </div>
          ) : (activity.data ?? []).length === 0 ? (
            <p className="text-body text-text-muted">No workflow events yet.</p>
          ) : (
            <ul className="space-y-3" data-testid="accounts-activity">
              {(activity.data ?? []).map((event) => (
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
