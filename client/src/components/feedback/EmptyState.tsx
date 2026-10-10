import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/common/Button'
import { Inbox, FileText, Search, Filter } from 'lucide-react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({ icon, title, description, action, secondaryAction, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-12 lg:py-16 px-4', className)}>
      {icon && (
        <div className="w-16 h-16 rounded-full bg-bg-surface border border-border-subtle flex items-center justify-center text-text-muted mb-6">
          {icon}
        </div>
      )}
      <h3 className="text-h2 text-text-primary mb-2">{title}</h3>
      {description && (
        <p className="text-body text-text-secondary max-w-sm mb-6">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
          {action && (
            <Button variant={action.variant || 'primary'} onClick={action.onClick} className="w-full sm:w-auto">
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="ghost" onClick={secondaryAction.onClick} className="w-full sm:w-auto">
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function EmptyVouchers({ onCreate, onClearFilters }: { onCreate?: () => void; onClearFilters?: () => void }) {
  return (
    <EmptyState
      icon={<Inbox className="h-8 w-8" />}
      title="No vouchers found"
      description="Get started by creating your first expense voucher, or try adjusting your filters."
      action={onCreate ? { label: 'Create Voucher', onClick: onCreate } : undefined}
      secondaryAction={onClearFilters ? { label: 'Clear Filters', onClick: onClearFilters } : undefined}
    />
  )
}

export function EmptySearch({ onClearFilters }: { onClearFilters?: () => void }) {
  return (
    <EmptyState
      icon={<Search className="h-8 w-8" />}
      title="No results found"
      description="Try adjusting your search terms or filters to find what you're looking for."
      secondaryAction={onClearFilters ? { label: 'Clear Filters', onClick: onClearFilters } : undefined}
    />
  )
}

export function EmptyDrafts({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={<FileText className="h-8 w-8" />}
      title="No draft vouchers"
      description="Start a new expense voucher and save it as a draft to continue later."
      action={onCreate ? { label: 'Create Draft', onClick: onCreate } : undefined}
    />
  )
}