import { useState, useRef, useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Search,
  Bell,
  ChevronDown,
  X,
  Shield,
  Menu,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDemoAuth } from '@/hooks/useDemoAuth'
import { UserMenu } from '@/components/overlays/Dropdown'
import { Button } from '@/components/common/Button'
import { Modal } from '@/components/overlays/Modal'
import type { UserRole } from '@/lib/utils'

export function TopNav({ onMenuClick, sidebarCollapsed }: { onMenuClick: () => void; sidebarCollapsed: boolean }) {
  const { role, user, switchRole, logout } = useDemoAuth()
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setNotificationsOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus()
    }
  }, [searchOpen])

  const demoRoles: UserRole[] = ['EMPLOYEE', 'DIRECTOR', 'ACCOUNTS']
  const rolePaths: Record<UserRole, string> = {
    EMPLOYEE: '/employee',
    DIRECTOR: '/director',
    ACCOUNTS: '/accounts',
  }

  const handleRoleSwitch = (newRole: UserRole) => {
    switchRole(newRole)
    navigate(rolePaths[newRole])
  }

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 h-16 bg-bg-surface/80 backdrop-blur-card border-b border-border-subtle transition-all duration-fast flex items-center',
        sidebarCollapsed ? 'left-16' : 'left-64'
      )}
      style={{ width: `calc(100% - ${sidebarCollapsed ? '64px' : '256px'})` }}
    >
      <div className="flex items-center justify-between w-full px-4 lg:px-6 gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden btn-icon p-1.5 text-text-muted hover:text-text-primary"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden lg:flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-text-primary text-sm">PSPL</span>
            <span className="text-caption text-text-muted">Expense Voucher Portal</span>
          </div>

          <div className="relative flex-1 max-w-md mx-auto lg:mx-0">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-2 bg-bg-base border border-border-subtle rounded-button text-text-secondary hover:border-border-focus transition-colors"
              aria-label="Global search"
            >
              <Search className="h-4 w-4 text-text-muted flex-shrink-0" />
              <span className="text-body">Search vouchers, employees...</span>
              <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs text-text-muted bg-bg-surface rounded border border-border-subtle">
                <kbd className="text-primary">⌘</kbd>K
              </kbd>
            </button>

            <AnimatePresence>
              {searchOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4"
                >
                  <div className="bg-bg-elevated border border-border-subtle rounded-card shadow-card-hover overflow-hidden">
                    <div className="p-4 border-b border-border-subtle flex items-center gap-3">
                      <Search className="h-5 w-5 text-text-muted" />
                      <input
                        ref={searchRef}
                        type="text"
                        placeholder="Search vouchers, employees, departments..."
                        className="flex-1 bg-transparent text-text-primary placeholder-text-muted text-body focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => setSearchOpen(false)}
                        className="btn-icon p-1.5 text-text-muted hover:text-text-primary"
                        aria-label="Close search"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="p-4">
                      <p className="text-caption text-text-muted mb-3">Recent searches</p>
                      <div className="flex flex-wrap gap-2">
                        {['Travel expenses', 'Pending approval', 'Rajesh Kumar', 'VCH-202610'].map((term) => (
                          <button
                            key={term}
                            className="px-3 py-1.5 text-caption text-text-secondary bg-bg-base border border-border-subtle rounded-button hover:border-primary hover:text-primary transition-colors"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="btn-icon p-2 relative text-text-muted hover:text-text-primary"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            <AnimatePresence>
              {notificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-80 bg-bg-elevated border border-border-subtle rounded-card shadow-card-hover"
                  role="menu"
                >
                  <div className="p-4 border-b border-border-subtle flex items-center justify-between">
                    <h3 className="text-body font-medium text-text-primary">Notifications</h3>
                    <button className="text-caption text-primary hover:underline">Mark all read</button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {[
                      { title: 'Voucher approved', message: 'VCH-20261001-0001 has been approved', time: '2h ago', unread: true },
                      { title: 'New voucher submitted', message: 'Priya Sharma submitted VCH-20261003-0002', time: '4h ago', unread: true },
                      { title: 'Voucher rejected', message: 'VCH-20261005-0003 requires revision', time: '1d ago', unread: false },
                    ].map((notif, i) => (
                      <div
                        key={i}
                        className={cn('p-4 border-b border-border-subtle/50 hover:bg-bg-surface transition-colors', notif.unread && 'bg-primary/5')}
                        role="menuitem"
                      >
                        <p className={cn('text-body font-medium', notif.unread && 'text-text-primary')}>{notif.title}</p>
                        <p className="text-caption text-text-secondary mt-0.5">{notif.message}</p>
                        <p className="text-caption text-text-muted mt-1">{notif.time}</p>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 border-t border-border-subtle">
                    <button className="w-full text-center text-caption text-primary hover:underline">View all notifications</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <UserMenu
            user={user}
            onLogout={logout}
            onSwitchRole={handleRoleSwitch}
            availableRoles={demoRoles}
            currentRole={role}
          />
        </div>
      </div>
    </header>
  )
}

export function PageHeader({
  title,
  description,
  breadcrumbs = [],
  actions,
}: {
  title: string
  description?: string
  breadcrumbs?: { label: string; path?: string }[]
  actions?: ReactNode
}) {
  return (
    <div className="page-header">
      <nav className="flex items-center gap-2 text-caption text-text-muted mb-3" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, index) => (
          <span key={index} className="flex items-center gap-2">
            {index > 0 && <ChevronDown className="h-3 w-3 rotate-90" />}
            {crumb.path ? (
              <a href={crumb.path} className="hover:text-text-primary transition-colors">
                {crumb.label}
              </a>
            ) : (
              <span className="text-text-primary font-medium">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="page-title">{title}</h1>
          {description && <p className="page-description">{description}</p>}
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">{actions}</div>
      </div>
    </div>
  )
}