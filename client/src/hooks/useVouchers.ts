import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  api,
  type AccountsDashboard,
  type ActivityFeedItem,
  type AnalyticsFilterParams,
  type ApiReferenceItem,
  type ApiVoucherDetail,
  type ApiWorkflowEvent,
  type CategoryBreakdownItem,
  type CreateVoucherBody,
  type DirectorDashboard,
  type EmployeeDashboard,
  type ExpenseTrend,
  type StatusDistributionItem,
  type UpdateVoucherBody,
  type VoucherListParams,
} from '@/lib/api'

/**
 * React Query hooks for the voucher workflow (Phases 5, 6 & 7).
 *
 * Every hook talks to the real backend through the shared `api` client; the
 * server is the only source of truth. Mutations invalidate exactly the
 * queries whose data they change so the UI re-derives from the server.
 */

// ---------------------------------------------------------------------------
// Query keys (single module so invalidation is consistent)
// ---------------------------------------------------------------------------

export const voucherKeys = {
  all: ['vouchers'] as const,
  list: (params: VoucherListParams) => ['vouchers', 'list', params] as const,
  detail: (id: string) => ['vouchers', 'detail', id] as const,
  events: (id: string) => ['vouchers', 'events', id] as const,
  employeeDashboard: ['vouchers', 'dashboard', 'employee'] as const,
  directorDashboard: ['vouchers', 'dashboard', 'director'] as const,
  accountsDashboard: ['vouchers', 'dashboard', 'accounts'] as const,
  analyticsStatus: (params: AnalyticsFilterParams) =>
    ['vouchers', 'analytics', 'status', params] as const,
  analyticsTrends: (params: AnalyticsFilterParams & { granularity?: 'day' | 'month' }) =>
    ['vouchers', 'analytics', 'trends', params] as const,
  analyticsCategories: (params: AnalyticsFilterParams) =>
    ['vouchers', 'analytics', 'categories', params] as const,
  activity: (limit: number) => ['vouchers', 'activity', limit] as const,
}

export const referenceKeys = {
  departments: ['reference', 'departments'] as const,
  categories: ['reference', 'categories'] as const,
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

export function useDepartments() {
  return useQuery({
    queryKey: referenceKeys.departments,
    queryFn: ({ signal }) => api.departments(signal),
  })
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: referenceKeys.categories,
    queryFn: ({ signal }) => api.expenseCategories(signal),
  })
}

// ---------------------------------------------------------------------------
// Dashboards
// ---------------------------------------------------------------------------

export function useEmployeeDashboard() {
  return useQuery({
    queryKey: voucherKeys.employeeDashboard,
    queryFn: ({ signal }) => api.employeeDashboard(signal),
  })
}

export function useDirectorDashboard() {
  return useQuery({
    queryKey: voucherKeys.directorDashboard,
    queryFn: ({ signal }) => api.directorDashboard(signal),
  })
}

// ---------------------------------------------------------------------------
// Phase 7: Accounts dashboard + analytics
// ---------------------------------------------------------------------------

export function useAccountsDashboard() {
  return useQuery({
    queryKey: voucherKeys.accountsDashboard,
    queryFn: ({ signal }) => api.accountsDashboard(signal),
  })
}

export function useAnalyticsStatus(params: AnalyticsFilterParams = {}) {
  return useQuery({
    queryKey: voucherKeys.analyticsStatus(params),
    queryFn: ({ signal }) => api.analyticsStatus(params, signal),
  })
}

export function useAnalyticsTrends(
  params: AnalyticsFilterParams & { granularity?: 'day' | 'month' } = {},
) {
  return useQuery({
    queryKey: voucherKeys.analyticsTrends(params),
    queryFn: ({ signal }) => api.analyticsTrends(params, signal),
  })
}

export function useAnalyticsCategories(params: AnalyticsFilterParams = {}) {
  return useQuery({
    queryKey: voucherKeys.analyticsCategories(params),
    queryFn: ({ signal }) => api.analyticsCategories(params, signal),
  })
}

export function useActivity(limit = 15) {
  return useQuery({
    queryKey: voucherKeys.activity(limit),
    queryFn: ({ signal }) => api.activity(limit, signal),
  })
}

// ---------------------------------------------------------------------------
// List & detail
// ---------------------------------------------------------------------------

export function useVoucherList(params: VoucherListParams = {}) {
  return useQuery({
    queryKey: voucherKeys.list(params),
    queryFn: ({ signal }) => api.vouchers(params, signal),
  })
}

export function useVoucher(id: string | undefined) {
  return useQuery({
    queryKey: voucherKeys.detail(id ?? ''),
    queryFn: ({ signal }) => api.voucher(id!, signal),
    enabled: Boolean(id),
  })
}

export function useVoucherEvents(id: string | undefined) {
  return useQuery({
    queryKey: voucherKeys.events(id ?? ''),
    queryFn: ({ signal }) => api.voucherEvents(id!, signal),
    enabled: Boolean(id),
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function useInvalidateVouchers() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: voucherKeys.all })
    void queryClient.invalidateQueries({ queryKey: voucherKeys.employeeDashboard })
    void queryClient.invalidateQueries({ queryKey: voucherKeys.directorDashboard })
    void queryClient.invalidateQueries({ queryKey: voucherKeys.accountsDashboard })
    void queryClient.invalidateQueries({ queryKey: ['vouchers', 'analytics'] })
    void queryClient.invalidateQueries({ queryKey: ['vouchers', 'activity'] })
  }
}

export function useCreateVoucher() {
  const invalidate = useInvalidateVouchers()
  return useMutation({
    mutationFn: (body: CreateVoucherBody) => api.createVoucher(body),
    onSuccess: invalidate,
  })
}

export function useUpdateVoucher() {
  const invalidate = useInvalidateVouchers()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateVoucherBody }) =>
      api.updateVoucher(id, body),
    onSuccess: invalidate,
  })
}

export function useDeleteVoucher() {
  const invalidate = useInvalidateVouchers()
  return useMutation({
    mutationFn: (id: string) => api.deleteVoucher(id),
    onSuccess: invalidate,
  })
}

export function useSubmitVoucher() {
  const invalidate = useInvalidateVouchers()
  return useMutation({
    mutationFn: (id: string) => api.submitVoucher(id),
    onSuccess: invalidate,
  })
}

export function useApproveVoucher() {
  const invalidate = useInvalidateVouchers()
  return useMutation({
    mutationFn: (id: string) => api.approveVoucher(id),
    onSuccess: invalidate,
  })
}

export function useRejectVoucher() {
  const invalidate = useInvalidateVouchers()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.rejectVoucher(id, reason),
    onSuccess: invalidate,
  })
}

export function useUploadSignature() {
  const invalidate = useInvalidateVouchers()
  return useMutation({
    mutationFn: ({ voucherId, file }: { voucherId: string; file: File }) =>
      api.uploadSignature(voucherId, file),
    onSuccess: invalidate,
  })
}

// ---------------------------------------------------------------------------
// Convenience selectors
// ---------------------------------------------------------------------------

export type {
  AccountsDashboard,
  ActivityFeedItem,
  ApiReferenceItem,
  ApiVoucherDetail,
  ApiWorkflowEvent,
  CategoryBreakdownItem,
  DirectorDashboard,
  EmployeeDashboard,
  ExpenseTrend,
  StatusDistributionItem,
}
