import { useState, useRef, useEffect, type ReactNode } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/common/Button'
import { Badge } from '@/components/common/Badge'
import type { ApiUser } from '@/lib/api'

interface DropdownItem {
  label: string
  onClick: () => void
  icon?: ReactNode
  disabled?: boolean
  variant?: 'default' | 'destructive'
}

interface DropdownProps {
  trigger: ReactNode
  items: DropdownItem[]
  align?: 'left' | 'right'
}

export function Dropdown({ trigger, items, align = 'right' }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div ref={dropdownRef} className="relative inline-block" onKeyDown={handleKeyDown}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className={cn(
              'fixed z-50 mt-2 min-w-[200px] bg-bg-elevated border border-border-subtle rounded-card shadow-card-hover animate-fade-in',
              align === 'right' ? 'right-0' : 'left-0'
            )}
            role="menu"
          >
            {items.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  item.onClick()
                  setIsOpen(false)
                }}
                disabled={item.disabled}
                className={cn(
                  'w-full px-4 py-2.5 text-left text-body flex items-center gap-3 transition-colors',
                  'hover:bg-bg-surface focus:outline-none focus:bg-bg-surface',
                  item.variant === 'destructive' ? 'text-red-400' : 'text-text-primary',
                  item.disabled && 'opacity-50 cursor-not-allowed'
                )}
                role="menuitem"
              >
                {item.icon && <span className="h-5 w-5 text-text-muted">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface DropdownMenuProps {
  trigger: ReactNode
  children: ReactNode
  align?: 'left' | 'right'
}

export function DropdownMenu({ trigger, children, align = 'right' }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={dropdownRef} className="relative inline-block">
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className={cn(
              'fixed z-50 mt-2 min-w-[200px] bg-bg-elevated border border-border-subtle rounded-card shadow-card-hover animate-fade-in',
              align === 'right' ? 'right-0' : 'left-0'
            )}
            role="menu"
          >
            <div className="py-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface DropdownItemProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'default' | 'destructive'
}

export function DropdownItem({ children, onClick, disabled, variant = 'default' }: DropdownItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full px-4 py-2.5 text-left text-body flex items-center gap-3 transition-colors',
        'hover:bg-bg-surface focus:outline-none focus:bg-bg-surface',
        variant === 'destructive' ? 'text-red-400' : 'text-text-primary',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      role="menuitem"
    >
      {children}
    </button>
  )
}

interface UserMenuProps {
  user: ApiUser
  onLogout: () => void
  /**
   * Role switching is intentionally NOT supported. A user's role comes from the
   * authenticated session issued by the server; changing it from the UI must
   * never be possible.
   */
  currentRole?: ApiUser['role']
}

export function UserMenu({ user, onLogout, currentRole }: UserMenuProps) {
  const initials = user.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase()
  return (
    <DropdownMenu
      trigger={
        <Button variant="ghost" className="gap-2 pr-2" aria-label={`User menu for ${user.fullName}`}>
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-medium text-primary text-sm">
            {initials}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-body font-medium text-text-primary">{user.fullName}</p>
            <p className="text-caption text-text-muted">{user.role}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-text-muted" />
        </Button>
      }
      align="right"
    >
      <div className="px-4 py-3 border-b border-border-subtle">
        <p className="text-body font-medium text-text-primary">{user.fullName}</p>
        <p className="text-caption text-text-muted">{user.email}</p>
        <Badge variant={currentRole?.toLowerCase() as any} className="mt-1">
          {currentRole || user.role}
        </Badge>
      </div>

      {/* No role switcher: the role is fixed by the authenticated session. */}

      <DropdownItem onClick={onLogout} variant="destructive">
        <X className="h-4 w-4" />
        Logout
      </DropdownItem>
    </DropdownMenu>
  )
}