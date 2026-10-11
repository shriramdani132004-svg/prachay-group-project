import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { ApiUser } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

/**
 * Client-side route protection.
 *
 * This is a UX affordance, NOT a security control: it prevents a user from
 * seeing screens they cannot use. The backend independently authorizes every
 * request, so navigating by URL gains nothing.
 */

function FullPageLoader({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <p className="text-body text-text-secondary" role="status" aria-live="polite">
        {label}
      </p>
    </div>
  )
}

function AccessDenied() {
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="card p-8 max-w-md text-center">
        <h1 className="text-h2 text-text-primary mb-2">Access denied</h1>
        <p className="text-body text-text-secondary">
          Your account does not have permission to view this page.
        </p>
      </div>
    </div>
  )
}

interface RequireAuthProps {
  children: ReactNode
  /** When provided, the authenticated user's role must match. */
  allowedRoles?: ApiUser['role'][]
}

export function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  // Never render protected content before authorization is known.
  if (isLoading) {
    return <FullPageLoader label="Checking your session..." />
  }

  if (!user) {
    // Remember where the user was headed so login can return them there.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <AccessDenied />
  }

  return <>{children}</>
}

/** Redirects an authenticated user away from the login page. */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <FullPageLoader label="Checking your session..." />
  }

  if (user) {
    return <Navigate to={homeForRole(user.role)} replace />
  }

  return <>{children}</>
}

export function homeForRole(role: ApiUser['role']): string {
  switch (role) {
    case 'DIRECTOR':
      return '/director'
    case 'ACCOUNTS':
      return '/accounts'
    case 'EMPLOYEE':
    default:
      return '/employee'
  }
}