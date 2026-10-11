import { useState, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar, MobileSidebar } from './Sidebar'
import { TopNav } from './TopNav'
import { cn } from '@/lib/utils'
import { ToastProvider } from '@/components/feedback/Toast'

export function Shell({ children }: { children?: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <ToastProvider>
      <div className="min-h-screen bg-bg-base">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <div
          className={cn(
            'transition-all duration-fast min-h-screen',
            sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'
          )}
        >
          <TopNav
            onMenuClick={() => setMobileMenuOpen(true)}
            sidebarCollapsed={sidebarCollapsed}
          />
          <main
            className="pt-16 transition-all duration-fast min-h-screen"
            id="main-content"
            tabIndex={-1}
          >
            {children || <Outlet />}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-bg-base flex">
        <main className="flex-1 w-full flex items-center justify-center p-4">
          {children}
        </main>
      </div>
    </ToastProvider>
  )
}