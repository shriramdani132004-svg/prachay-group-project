import { Link } from 'react-router-dom'
import { FileText, Clock, CheckCircle, XCircle, DollarSign, TrendingUp, BarChart3 } from 'lucide-react'
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
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export function AccountsDashboard() {
  const { user } = useDemoAuth()
  const kpis = getDashboardKPIs('ACCOUNTS')
  const approvedVouchers = demoVouchers.filter((v) => v.status === 'APPROVED').slice(0, 5)

  const chartData = [
    { month: 'Jan', amount: 120000 },
    { month: 'Feb', amount: 180000 },
    { month: 'Mar', amount: 150000 },
    { month: 'Apr', amount: 220000 },
    { month: 'May', amount: 190000 },
    { month: 'Jun', amount: 250000 },
    { month: 'Jul', amount: 280000 },
    { month: 'Aug', amount: 240000 },
    { month: 'Sep', amount: 310000 },
    { month: 'Oct', amount: 290000 },
  ]

  return (
    <div className="page-container animate-fade-in">
      <PageHeader
        title="Accounts Dashboard"
        description={`Welcome, Finance Team. Monitor reimbursement pipeline and organizational spending.`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        <KPICard title="Total Vouchers" value={kpis.totalVouchers} icon={<FileText className="h-6 w-6" />} trend={{ value: 8, positive: true }} />
        <KPICard title="Pending Approval" value={kpis.pendingApproval} icon={<Clock className="h-6 w-6" />} trend={{ value: -5, positive: true }} />
        <KPICard title="Approved Vouchers" value={kpis.approvedVouchers} icon={<CheckCircle className="h-6 w-6" />} trend={{ value: 12, positive: true }} />
        <KPICard title="Rejected Vouchers" value={kpis.rejectedVouchers} icon={<XCircle className="h-6 w-6" />} trend={{ value: 3, positive: false }} />
        <KPICard title="Total Approved Amount" value={kpis.totalApprovedExpenseAmount || 0} icon={<DollarSign className="h-6 w-6" />} trend={{ value: 18, positive: true }} />
        <KPICard title="Recent Approved" value={kpis.recentApprovedVouchers || 0} icon={<TrendingUp className="h-6 w-6" />} trend={{ value: 10, positive: true }} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="lg:col-span-2">
          <h3 className="text-h2 text-text-primary mb-4">Monthly Approved Spending Trend</h3>
          <div className="h-72">
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
                  tickFormatter={(value) => `₹${(value / 100000).toFixed(1)}L`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    border: '1px solid #1E293B',
                    borderRadius: '8px',
                    color: '#F8FAFC',
                  }}
                  formatter={(value: any) => [formatCurrency(typeof value === 'number' ? value : 0), 'Approved Amount']}
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
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-h2 text-text-primary">Recent Approved Vouchers</h3>
            <Link to="/accounts/vouchers?status=APPROVED">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </div>
          {approvedVouchers.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto text-text-muted mb-4" />
              <p className="text-body text-text-secondary">No approved vouchers yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {approvedVouchers.map((voucher) => (
                <div key={voucher.id} className="flex items-center justify-between p-3 bg-bg-base rounded-button hover:bg-border-subtle/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">{voucher.voucherNumber}</p>
                      <p className="text-caption text-text-muted">{voucher.employee?.fullName} • {voucher.department}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono tabular-nums font-medium text-text-primary">{formatCurrency(voucher.amount)}</p>
                    <Badge variant="approved">Approved</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-h2 text-text-primary mb-4">Quick Stats</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-bg-base rounded-button">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">Total Organizational Vouchers</p>
                  <p className="text-caption text-text-muted">All departments combined</p>
                </div>
              </div>
              <span className="text-display tabular-nums font-bold text-text-primary">{kpis.totalVouchers}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-bg-base rounded-button">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">Pending Review</p>
                  <p className="text-caption text-text-muted">Awaiting director action</p>
                </div>
              </div>
              <span className="text-display tabular-nums font-bold text-amber-400">{kpis.pendingApproval}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-bg-base rounded-button">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">Total Approved Exposure</p>
                  <p className="text-caption text-text-muted">Approved amount pending disbursement</p>
                </div>
              </div>
              <span className="text-display tabular-nums font-bold text-emerald-400">{formatCurrency(kpis.totalApprovedExpenseAmount || 0)}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}