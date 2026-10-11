/**
 * Shared API client.
 *
 * Security properties:
 * - Always sends cookies with `credentials: 'include'` (session is HttpOnly).
 * - Never reads or stores the JWT; it is unreachable from JavaScript by design.
 * - Sends the in-memory CSRF token on unsafe methods.
 * - Never persists credentials or tokens to localStorage/sessionStorage.
 * - Parses the project's standard success/error envelope.
 */

const API_PREFIX = '/api/v1'

export interface ApiUser {
  id: string
  email: string
  fullName: string
  role: 'EMPLOYEE' | 'DIRECTOR' | 'ACCOUNTS'
  employeeId: string | null
}

export interface SessionPayload {
  user: ApiUser
  csrfToken: string
  expiresAt: string
}

interface ErrorEnvelope {
  success: false
  error: { code: string; message: string; details?: { field: string; issue: string }[] }
  meta?: { requestId?: string }
}

/** CSRF token held in memory only. Never written to browser storage. */
let csrfToken: string | null = null

export function setCsrfToken(token: string | null): void {
  csrfToken = token
}

export function getCsrfToken(): string | null {
  return csrfToken
}

/** Signals that the session is gone so the app can return to the login screen. */
export class UnauthorizedError extends Error {
  readonly code = 'UNAUTHORIZED'
}

export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
  }
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

interface RequestOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
}

interface FullEnvelope<T> {
  data: T
  meta?: { pagination?: PaginationMeta; timestamp?: string; requestId?: string }
}

/** Standard pagination metadata returned by list endpoints. */
export interface PaginationMeta {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

async function requestFull<T>(
  path: string,
  options: RequestOptions = {},
): Promise<FullEnvelope<T>> {
  const method = (options.method ?? 'GET').toUpperCase()

  const headers: Record<string, string> = { Accept: 'application/json' }

  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  // CSRF is required on every cookie-authenticated state-changing request.
  if (UNSAFE_METHODS.has(method) && csrfToken) {
    headers['X-CSRF-Token'] = csrfToken
  }

  const response = await fetch(`${API_PREFIX}${path}`, {
    method,
    headers,
    // Session cookie is HttpOnly; this is what makes it travel.
    credentials: 'include',
    body:
      options.body === undefined
        ? undefined
        : options.body instanceof FormData
          ? options.body
          : JSON.stringify(options.body),
    signal: options.signal,
  })

  if (response.status === 204) {
    return { data: undefined as T }
  }

  const text = await response.text()
  let payload: unknown = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }

  if (!response.ok) {
    const envelope = payload as ErrorEnvelope | null
    const code = envelope?.error?.code ?? 'UNKNOWN'
    const message = envelope?.error?.message ?? 'Something went wrong. Please try again.'

    // Session expired or revoked: let the app fall back to the login screen.
    if (response.status === 401) {
      csrfToken = null
      throw new UnauthorizedError(message)
    }

    throw new ApiRequestError(response.status, code, message)
  }

  const success = payload as FullEnvelope<T> | null
  return { data: success?.data as T, meta: success?.meta }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await requestFull<T>(path, options)).data
}

/** Builds a URLSearchParams for analytics filter params (shared by the three analytics endpoints). */
function analyticsQuery(params: AnalyticsFilterParams): URLSearchParams {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.departmentId) query.set('departmentId', params.departmentId)
  if (params.expenseCategoryId) query.set('expenseCategoryId', params.expenseCategoryId)
  if (params.dateFrom) query.set('dateFrom', params.dateFrom)
  if (params.dateTo) query.set('dateTo', params.dateTo)
  return query
}

export const api = {
  /** Verifies the current session and returns the sanitized user + CSRF token. */
  me: (signal?: AbortSignal) => request<SessionPayload>('/auth/me', { signal }),

  login: (email: string, password: string) =>
    request<SessionPayload>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  logout: () => request<{ revoked: boolean }>('/auth/logout', { method: 'POST' }),

  // -------------------------------------------------------------------------
  // Vouchers (Phases 5 & 6)
  // -------------------------------------------------------------------------

  /** Employee dashboard: own-scope aggregates + recent vouchers. */
  employeeDashboard: (signal?: AbortSignal) =>
    request<EmployeeDashboard>('/vouchers/dashboard', { signal }),

  /** Director dashboard: organization-wide aggregates + recent activity. */
  directorDashboard: (signal?: AbortSignal) =>
    request<DirectorDashboard>('/vouchers/director/dashboard', { signal }),

  // -------------------------------------------------------------------------
  // Phase 7: Accounts dashboard + analytics
  // -------------------------------------------------------------------------

  /** Accounts dashboard: organization-wide totals + recent approved. */
  accountsDashboard: (signal?: AbortSignal) =>
    request<AccountsDashboard>('/vouchers/accounts/dashboard', { signal }),

  /** Status distribution (count + amount per status, scope-correct). */
  analyticsStatus: (params: AnalyticsFilterParams = {}, signal?: AbortSignal) => {
    const query = analyticsQuery(params)
    return request<StatusDistributionItem[]>(`/vouchers/analytics/status${query}`, { signal })
  },

  /** Expense trend grouped by expenseDate (default 12-month month buckets). */
  analyticsTrends: (
    params: AnalyticsFilterParams & { granularity?: 'day' | 'month' } = {},
    signal?: AbortSignal,
  ) => {
    const query = analyticsQuery(params)
    if (params.granularity) {
      query.set('granularity', params.granularity)
    }
    const qs = query.toString()
    return request<ExpenseTrend>(`/vouchers/analytics/trends${qs ? `?${qs}` : ''}`, { signal })
  },

  /** Per-category breakdown with decimal-safe percentage shares. */
  analyticsCategories: (params: AnalyticsFilterParams = {}, signal?: AbortSignal) => {
    const query = analyticsQuery(params)
    return request<CategoryBreakdownItem[]>(`/vouchers/analytics/categories${query}`, { signal })
  },

  /** Role-scoped recent activity (own for Employee, organization for Director/Accounts). */
  activity: (limit = 15, signal?: AbortSignal) =>
    request<ActivityFeedItem[]>(`/vouchers/activity?limit=${limit}`, { signal }),

  /**
   * Voucher list. Employees receive own-scope items; Directors/Accounts
   * receive organization-wide items. Server-side filter/sort/pagination.
   */
  vouchers: (params: VoucherListParams = {}, signal?: AbortSignal) => {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    if (params.sortBy) query.set('sortBy', params.sortBy)
    if (params.sortOrder) query.set('sortOrder', params.sortOrder)
    if (params.search) query.set('search', params.search)
    if (params.status) query.set('status', params.status)
    if (params.departmentId) query.set('departmentId', params.departmentId)
    if (params.expenseCategoryId) query.set('expenseCategoryId', params.expenseCategoryId)
    if (params.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params.dateTo) query.set('dateTo', params.dateTo)
    if (params.minAmount !== undefined) query.set('minAmount', String(params.minAmount))
    if (params.maxAmount !== undefined) query.set('maxAmount', String(params.maxAmount))

    const qs = query.toString()
    return requestFull<{ scope: 'own' | 'organization'; items: ApiVoucher[] }>(
      `/vouchers${qs ? `?${qs}` : ''}`,
      { signal },
    )
  },

  voucher: (id: string, signal?: AbortSignal) =>
    request<ApiVoucherDetail>(`/vouchers/${id}`, { signal }),

  voucherEvents: (id: string, signal?: AbortSignal) =>
    request<ApiWorkflowEvent[]>(`/vouchers/${id}/events`, { signal }),

  createVoucher: (body: CreateVoucherBody) =>
    request<ApiVoucherDetail>('/vouchers', { method: 'POST', body }),

  updateVoucher: (id: string, body: UpdateVoucherBody) =>
    request<ApiVoucherDetail>(`/vouchers/${id}`, { method: 'PATCH', body }),

  deleteVoucher: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/vouchers/${id}`, { method: 'DELETE' }),

  submitVoucher: (id: string) =>
    request<ApiVoucherDetail>(`/vouchers/${id}/submit`, { method: 'POST' }),

  approveVoucher: (id: string) =>
    request<ApiVoucherDetail>(`/vouchers/${id}/approve`, { method: 'POST' }),

  rejectVoucher: (id: string, reason: string) =>
    request<ApiVoucherDetail>(`/vouchers/${id}/reject`, { method: 'POST', body: { reason } }),

  // -------------------------------------------------------------------------
  // Signatures (Phases 5 & 6)
  // -------------------------------------------------------------------------

  /**
   * Uploads a signature image (multipart: `file` + `voucherId`).
   * The signature type (EMPLOYEE/DIRECTOR) is derived server-side from the
   * authenticated role; it is never sent by the client.
   */
  uploadSignature: (voucherId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    form.append('voucherId', voucherId)
    return request<ApiSignatureMeta>('/signatures/upload', { method: 'POST', body: form })
  },

  /** Authorized URL for streaming signature bytes (session cookie travels). */
  signatureUrl: (signatureId: string) => `${API_PREFIX}/signatures/${signatureId}`,

  // -------------------------------------------------------------------------
  // Reference data (authenticated organization metadata)
  // -------------------------------------------------------------------------

  departments: (signal?: AbortSignal) =>
    request<ApiReferenceItem[]>('/departments?pageSize=100', { signal }),

  expenseCategories: (signal?: AbortSignal) =>
    request<ApiReferenceItem[]>('/expense-categories?pageSize=100', { signal }),
}

// ---------------------------------------------------------------------------
// Voucher types (mirror the server's serialized shapes)
// ---------------------------------------------------------------------------

export type ApiVoucherStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'

/** Summary shape returned by list endpoints and dashboards. */
export interface ApiVoucher {
  id: string
  voucherNumber: string
  voucherDate: string
  expenseDate: string
  expenseTitle: string
  /** Exact decimal string (e.g. "1500.50"). Never a float. */
  amount: string
  currency: string
  status: ApiVoucherStatus
  departmentId: string
  departmentName: string
  expenseCategoryId: string
  expenseCategoryName: string
  createdById: string
  createdByName: string | null
  submittedAt: string | null
  approvedAt: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
}

export interface ApiSignatureMeta {
  id: string
  type: 'EMPLOYEE' | 'DIRECTOR'
  mimeType: string
  sizeBytes: number
  createdAt: string
}

/** Full detail returned by GET /vouchers/:id and all mutations. */
export interface ApiVoucherDetail extends ApiVoucher {
  expenseDescription: string | null
  employeeIdSnapshot: string | null
  employeeNameSnapshot: string | null
  reviewedByName: string | null
  signatures: ApiSignatureMeta[]
}

export interface ApiWorkflowEvent {
  id: string
  type: 'CREATED' | 'UPDATED' | 'SUBMITTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
  fromStatus: ApiVoucherStatus | null
  toStatus: ApiVoucherStatus | null
  actorName: string | null
  reason: string | null
  createdAt: string
}

export interface EmployeeDashboard {
  totalVouchers: number
  draftVouchers: number
  pendingApproval: number
  approvedVouchers: number
  rejectedVouchers: number
  /** SUM of the employee's own voucher amounts across all statuses. */
  totalAmountClaimed: string
  recentVouchers: ApiVoucher[]
}

export interface DirectorDashboard {
  pendingApprovalCount: number
  approvedToday: number
  rejectedToday: number
  /** SUM of pending voucher amounts (NUMERIC string). */
  totalPendingAmount: string
  recentActivity: {
    id: string
    type: ApiWorkflowEvent['type']
    voucherNumber: string
    actorName: string | null
    createdAt: string
    reason: string | null
  }[]
  recentVouchers: ApiVoucher[]
}

// ---------------------------------------------------------------------------
// Phase 7: Accounts dashboard + analytics
// ---------------------------------------------------------------------------

export interface AccountsDashboard {
  totalVouchers: number
  pendingApprovalCount: number
  approvedCount: number
  rejectedCount: number
  /** SUM(amount) over APPROVED vouchers (NUMERIC string). */
  totalApprovedExpenseAmount: string
  recentApprovedVouchers: {
    id: string
    voucherNumber: string
    expenseTitle: string
    amount: string
    currency: string
    approvedAt: string
    reviewedByName: string | null
    createdByName: string | null
    departmentName: string
  }[]
}

export interface StatusDistributionItem {
  status: ApiVoucherStatus
  count: number
  /** SUM of amounts in this status (NUMERIC string). */
  totalAmount: string
}

export interface ExpenseTrendPoint {
  /** Bucket start: YYYY-MM (month) or YYYY-MM-DD (day). */
  period: string
  count: number
  totalAmount: string
}

export interface ExpenseTrend {
  granularity: 'day' | 'month'
  from: string
  to: string
  points: ExpenseTrendPoint[]
}

export interface CategoryBreakdownItem {
  categoryId: string
  categoryName: string
  count: number
  totalAmount: string
  /** Share of scoped total amount, 0-100, two decimals. */
  percentage: string
}

export interface ActivityFeedItem {
  id: string
  type: string
  voucherId: string
  voucherNumber: string
  actorName: string | null
  createdAt: string
  reason: string | null
}

export interface AnalyticsFilterParams {
  status?: ApiVoucherStatus
  departmentId?: string
  expenseCategoryId?: string
  dateFrom?: string
  dateTo?: string
}

export interface VoucherListParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  status?: ApiVoucherStatus
  departmentId?: string
  expenseCategoryId?: string
  dateFrom?: string
  dateTo?: string
  minAmount?: number
  maxAmount?: number
}

export interface CreateVoucherBody {
  departmentId: string
  expenseTitle: string
  expenseCategoryId: string
  expenseDate: string
  amount: number
  expenseDescription?: string
  voucherDate?: string
}

export type UpdateVoucherBody = Partial<CreateVoucherBody>

/** Reference item shape shared by departments and expense categories. */
export interface ApiReferenceItem {
  id: string
  code: string
  name: string
}