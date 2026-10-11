import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'

interface KPICardProps {
  title: string
  value: string | number
  icon?: ReactNode
  /**
   * How to render a numeric value. Counters stay plain integers; only
   * monetary KPIs should be formatted as currency.
   */
  format?: 'currency' | 'count'
  trend?: {
    value: number
    label?: string
    positive?: boolean
  }
  loading?: boolean
  className?: string
}

export function KPICard({ title, value, icon, format = 'currency', trend, loading, className }: KPICardProps) {
  const displayValue =
    typeof value === 'number' ? (format === 'currency' ? formatCurrency(value) : value.toLocaleString('en-IN')) : value

  return (
    <div className={cn('kpi-card', className)}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-caption text-text-muted mb-1.5">{title}</p>
          {loading ? (
            <div className="skeleton h-10 w-3/4" />
          ) : (
            <p
              className={cn(
                'tabular-nums text-text-primary',
                // Currency strings are much wider than counts; use a smaller
                // type size so they stay on one line at typical card widths.
                format === 'currency' ? 'text-h1 break-words' : 'text-display'
              )}
            >
              {displayValue}
            </p>
          )}
        </div>
        {icon && (
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
            {icon}
          </div>
        )}
      </div>
      {trend && !loading && (
        <div className="mt-4 flex items-center gap-2">
          <span className={cn(
            'text-caption font-medium flex items-center gap-1',
            trend.positive !== false ? 'text-emerald-400' : 'text-red-400'
          )}>
            {trend.positive !== false ? (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                <polyline points="17 18 23 18 23 12" />
              </svg>
            )}
            {Math.abs(trend.value).toFixed(1)}%
            {trend.label && <span className="text-text-muted">vs {trend.label}</span>}
          </span>
        </div>
      )}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string | number
  description?: string
  icon?: ReactNode
  loading?: boolean
}

export function StatCard({ label, value, description, icon, loading }: StatCardProps) {
  const displayValue = typeof value === 'number' ? formatCurrency(value) : value

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-caption text-text-muted">{label}</p>
          {loading ? (
            <div className="skeleton h-8 w-1/2 mt-1" />
          ) : (
            <p className="text-h2 tabular-nums text-text-primary mt-1">{displayValue}</p>
          )}
          {description && (
            <p className="text-caption text-text-secondary mt-1">{description}</p>
          )}
        </div>
        {icon && (
          <div className="w-10 h-10 rounded-lg bg-bg-base flex items-center justify-center text-text-muted flex-shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}