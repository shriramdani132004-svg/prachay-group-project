import { createBrowserRouter } from 'react-router-dom'
import { Shell } from '@/components/layout/Shell'
import { PublicLayout } from '@/components/layout/Shell'
import { LoginPage } from '@/features/auth/LoginPage'
import { EmployeeDashboard } from '@/features/employee/EmployeeDashboard'
import { MyVouchers } from '@/features/employee/MyVouchers'
import { CreateVoucher } from '@/features/employee/CreateVoucher'
import { VoucherDetail as EmployeeVoucherDetail } from '@/features/employee/VoucherDetail'
import { DirectorDashboard } from '@/features/director/DirectorDashboard'
import { ApprovalQueue } from '@/features/director/ApprovalQueue'
import { VoucherReview } from '@/features/director/VoucherReview'
import { AccountsDashboard } from '@/features/accounts/AccountsDashboard'
import { VoucherRegister } from '@/features/accounts/VoucherRegister'
import { AccountsVoucherDetail } from '@/features/accounts/VoucherDetail'
import { NotFound } from '@/features/NotFound'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      {
        path: 'login',
        element: <PublicLayout><LoginPage onDemoLogin={() => {}} /></PublicLayout>,
      },
      {
        path: 'employee',
        element: <EmployeeDashboard />,
      },
      {
        path: 'employee/vouchers',
        element: <MyVouchers />,
      },
      {
        path: 'employee/vouchers/new',
        element: <CreateVoucher />,
      },
      {
        path: 'employee/vouchers/:id/edit',
        element: <CreateVoucher isEdit />,
      },
      {
        path: 'employee/vouchers/:id',
        element: <EmployeeVoucherDetail />,
      },
      {
        path: 'director',
        element: <DirectorDashboard />,
      },
      {
        path: 'director/approvals',
        element: <ApprovalQueue />,
      },
      {
        path: 'director/vouchers/:id',
        element: <VoucherReview />,
      },
      {
        path: 'accounts',
        element: <AccountsDashboard />,
      },
      {
        path: 'accounts/vouchers',
        element: <VoucherRegister />,
      },
      {
        path: 'accounts/vouchers/:id',
        element: <AccountsVoucherDetail />,
      },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
])