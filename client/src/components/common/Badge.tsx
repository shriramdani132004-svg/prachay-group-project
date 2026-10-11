import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'draft'
    | 'submitted'
    | 'pending'
    | 'pending_approval'
    | 'approved'
    | 'rejected'
  dot?: boolean
}

export const Badge = ({ className, variant = 'default', dot = true, children, ...props }: BadgeProps) => {
  const variants = {
    default: 'badge bg-slate-800/80 text-slate-300 border border-slate-700',
    draft: 'badge-draft',
    submitted: 'badge-submitted',
    pending: 'badge-pending',
    pending_approval: 'badge-pending',
    approved: 'badge-approved',
    rejected: 'badge-rejected',
  }

  return (
    <span className={cn(variants[variant], className)} {...props}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full bg-current animate-pulse', variant !== 'default' && '')} aria-hidden="true" />}
      {children}
    </span>
  )
}

export const StatusBadge = ({ status, className, ...props }: { status: string; className?: string } & HTMLAttributes<HTMLSpanElement>) => {
  return <Badge variant={status.toLowerCase() as any} className={className} {...props}>{status}</Badge>
}