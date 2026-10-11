import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, setCsrfToken, UnauthorizedError, type ApiUser } from '@/lib/api'

/**
 * Server-backed authentication context (Phase 4).
 *
 * Identity comes ONLY from the API. There is deliberately:
 * - no localStorage/sessionStorage persistence of identity or tokens,
 * - no demo role selector that can grant authentication,
 * - no client-side role source of truth.
 *
 * A frontend role value is used solely to decide which UI to render; the server
 * independently enforces every authorization decision.
 */

export interface AuthContextValue {
  user: ApiUser | null
  /** True until the initial /auth/me request settles. Guards protected content. */
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<ApiUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null)
  // Starts true so protected content never flashes before authorization is known.
  const [isLoading, setIsLoading] = useState(true)

  // Rehydrate the session on mount / refresh via the server.
  useEffect(() => {
    const controller = new AbortController()

    api
      .me(controller.signal)
      .then((session) => {
        setUser(session.user)
        setCsrfToken(session.csrfToken)
      })
      .catch((error) => {
        // Not signed in, or the session expired/revoked: remain logged out.
        if (!(error instanceof UnauthorizedError)) {
          // Network or server failure: still treat as logged out rather than
          // inventing a user.
        }
        setUser(null)
        setCsrfToken(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const session = await api.login(email, password)
    setCsrfToken(session.csrfToken)
    setUser(session.user)
    return session.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch (error) {
      // An already-expired session must not block the UI from logging out.
      if (!(error instanceof UnauthorizedError)) throw error
    } finally {
      // Always clear local state, including the in-memory CSRF token.
      setUser(null)
      setCsrfToken(null)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: user !== null, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/** Role for routing decisions. Derived from the server-provided user only. */
export function useRole(): ApiUser['role'] | null {
  const { user } = useAuth()
  return user?.role ?? null
}

/**
 * The authenticated user, guaranteed non-null.
 *
 * Only valid inside a <RequireAuth> subtree, which renders children exclusively
 * when a session exists. Throwing here is intentional: reaching it outside a
 * guard is a programming error, not a runtime condition to paper over.
 */
export function useAuthenticatedUser(): ApiUser {
  const { user } = useAuth()
  if (!user) {
    throw new Error('useAuthenticatedUser must be used inside a protected route')
  }
  return user
}