import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Shell } from '@/components/layout/Shell'
import { PublicLayout } from '@/components/layout/Shell'
import { RequireAuth, RedirectIfAuthenticated } from '@/components/auth/RouteGuards'
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

/**
 * Route table (Phase 4).
 *
 * Protected routes declare the roles permitted to view them. The backend
 * enforces the same rules independently - this only shapes the UI.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      {
        index: true,
        element: <Navigate to="/login" replace />,
      },
      {
        path: 'login',
        element: (
          <PublicLayout>
            <RedirectIfAuthenticated>
              <LoginPage />
            </RedirectIfAuthenticated>
          </PublicLayout>
        ),
      },

      // --- Employee ---------------------------------------------------------
      {
        path: 'employee',
        element: (
          <RequireAuth allowedRoles={['EMPLOYEE']}>
            <EmployeeDashboard />
          </RequireAuth>
        ),
      },
      {
        path: 'employee/vouchers',
        element: (
          <RequireAuth allowedRoles={['EMPLOYEE']}>
            <MyVouchers />
          </RequireAuth>
        ),
      },
      {
        path: 'employee/vouchers/new',
        element: (
          <RequireAuth allowedRoles={['EMPLOYEE']}>
            <CreateVoucher />
          </RequireAuth>
        ),
      },
      {
        path: 'employee/vouchers/:id/edit',
        element: (
          <RequireAuth allowedRoles={['EMPLOYEE']}>
            <CreateVoucher isEdit />
          </RequireAuth>
        ),
      },
      {
        path: 'employee/vouchers/:id',
        element: (
          <RequireAuth allowedRoles={['EMPLOYEE']}>
            <EmployeeVoucherDetail />
          </RequireAuth>
        ),
      },

      // --- Director ---------------------------------------------------------
      {
        path: 'director',
        element: (
          <RequireAuth allowedRoles={['DIRECTOR']}>
            <DirectorDashboard />
          </RequireAuth>
        ),
      },
      {
        path: 'director/approvals',
        element: (
          <RequireAuth allowedRoles={['DIRECTOR']}>
            <ApprovalQueue />
          </RequireAuth>
        ),
      },
      {
        path: 'director/vouchers/:id',
        element: (
          <RequireAuth allowedRoles={['DIRECTOR']}>
            <VoucherReview />
          </RequireAuth>
        ),
      },

      // --- Accounts ---------------------------------------------------------
      {
        path: 'accounts',
        element: (
          <RequireAuth allowedRoles={['ACCOUNTS']}>
            <AccountsDashboard />
          </RequireAuth>
        ),
      },
      {
        path: 'accounts/vouchers',
        element: (
          <RequireAuth allowedRoles={['ACCOUNTS']}>
            <VoucherRegister />
          </RequireAuth>
        ),
      },
      {
        path: 'accounts/vouchers/:id',
        element: (
          <RequireAuth allowedRoles={['ACCOUNTS']}>
            <AccountsVoucherDetail />
          </RequireAuth>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
])