import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { User, UserRole } from '@/lib/utils'
import { demoUsers } from '@/data/demo-data'

interface DemoAuthContextValue {
  user: User
  role: UserRole
  switchRole: (role: UserRole) => void
  logout: () => void
}

const DemoAuthContext = createContext<DemoAuthContextValue | null>(null)

const defaultUser: User = demoUsers[0]

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(defaultUser)
  const [role, setRole] = useState<UserRole>(defaultUser.role)

  useEffect(() => {
    const savedRole = localStorage.getItem('demoRole') as UserRole | null
    const savedUserId = localStorage.getItem('demoUserId')
    if (savedRole && demoUsers.find((u) => u.role === savedRole)) {
      const foundUser = demoUsers.find((u) => u.role === savedRole) || demoUsers[0]
      setRole(savedRole)
      setUser(foundUser)
    } else if (savedUserId) {
      const foundUser = demoUsers.find((u) => u.id === savedUserId) || demoUsers[0]
      setUser(foundUser)
      setRole(foundUser.role)
    }
  }, [])

  const switchRole = (newRole: UserRole) => {
    const foundUser = demoUsers.find((u) => u.role === newRole) || demoUsers[0]
    setRole(newRole)
    setUser(foundUser)
    localStorage.setItem('demoRole', newRole)
    localStorage.setItem('demoUserId', foundUser.id)
  }

  const logout = () => {
    localStorage.removeItem('demoRole')
    localStorage.removeItem('demoUserId')
    setUser(defaultUser)
    setRole(defaultUser.role)
  }

  const value = { user, role, switchRole, logout }

  return (
    DemoAuthContext.Provider as any
  )({
    value,
    children
  })
}

export function useDemoAuth() {
  const context = useContext(DemoAuthContext)
  if (!context) {
    throw new Error('useDemoAuth must be used within a DemoAuthProvider')
  }
  return context
}