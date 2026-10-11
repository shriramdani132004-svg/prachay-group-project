import { type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  History,
  Inbox,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  Shield,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface NavItem {
  label: string
  path: string
  icon: ReactNode
  badge?: number
}

const roleNavigation: Record<string, NavItem[]> = {
  EMPLOYEE: [
    { label: 'Dashboard', path: '/employee', icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: 'My Vouchers', path: '/employee/vouchers', icon: <FileText className="h-5 w-5" /> },
    { label: 'Create Voucher', path: '/employee/vouchers/new', icon: <PlusCircle className="h-5 w-5" /> },
    { label: 'History', path: '/employee/history', icon: <History className="h-5 w-5" /> },
  ],
  DIRECTOR: [
    { label: 'Dashboard', path: '/director', icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: 'Approval Queue', path: '/director/approvals', icon: <Inbox className="h-5 w-5" />, badge: 3 },
    { label: 'All Vouchers', path: '/director/vouchers', icon: <FileText className="h-5 w-5" /> },
    { label: 'Analytics', path: '/director/analytics', icon: <BarChart3 className="h-5 w-5" /> },
  ],
  ACCOUNTS: [
    { label: 'Dashboard', path: '/accounts', icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: 'Voucher Register', path: '/accounts/vouchers', icon: <FileText className="h-5 w-5" /> },
    { label: 'Approved Vouchers', path: '/accounts/approved', icon: <CheckCircle className="h-5 w-5" /> },
    { label: 'Financial Reports', path: '/accounts/reports', icon: <BarChart3 className="h-5 w-5" /> },
  ],
}

import { CheckCircle } from 'lucide-react'

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const role = useAuth()?.user?.role ?? 'EMPLOYEE'
  const navItems = roleNavigation[role] || roleNavigation.EMPLOYEE

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-bg-surface border-r border-border-subtle transition-all duration-fast hidden lg:flex lg:flex-col',
        collapsed ? 'w-16' : 'w-64'
      )}
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-between h-16 px-4 border-b border-border-subtle">
        <div className={cn('flex items-center gap-3 transition-opacity duration-fast', collapsed && 'opacity-0 w-0')}>
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <span className="font-semibold text-text-primary text-sm">PSPL</span>
        </div>
        <button
          onClick={onToggle}
          className="btn-icon p-1.5 text-text-muted hover:text-text-primary"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-button text-body transition-all duration-fast',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bg-base',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-text-secondary hover:bg-bg-base hover:text-text-primary'
              )
            }
            title={collapsed ? item.label : undefined}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            {!collapsed && (
              <>
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && (
                  <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded-full">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={cn('p-3 border-t border-border-subtle transition-opacity duration-fast', collapsed && 'opacity-0 h-0 overflow-hidden')}>
        <div className="text-caption text-text-muted px-3 mb-2 uppercase tracking-wider">
          Settings
        </div>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-button text-body transition-all duration-fast',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bg-base',
              isActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-text-secondary hover:bg-bg-base hover:text-text-primary'
            )
          }
        >
          <Settings className="h-5 w-5 flex-shrink-0" />
          <span>Preferences</span>
        </NavLink>
      </div>
    </aside>
  )
}

export function MobileSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const role = useAuth()?.user?.role ?? 'EMPLOYEE'
  const navItems = roleNavigation[role] || roleNavigation.EMPLOYEE

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className="fixed left-0 top-0 z-50 h-screen w-64 bg-bg-surface border-r border-border-subtle lg:hidden flex flex-col"
            aria-label="Mobile navigation"
          >
            <div className="flex items-center justify-between h-16 px-4 border-b border-border-subtle">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <span className="font-semibold text-text-primary">PSPL</span>
              </div>
              <button
                onClick={onClose}
                className="btn-icon p-1.5 text-text-muted hover:text-text-primary"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Navigation">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-button text-body transition-all duration-fast',
                      'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bg-base',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-text-secondary hover:bg-bg-base hover:text-text-primary'
                    )
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded-full">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}