import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular' | 'kpi'
  width?: string | number
  height?: string | number
  lines?: number
}

export function Skeleton({ className, variant = 'text', width, height, lines = 1 }: SkeletonProps) {
  if (variant === 'kpi') {
    return (
      <div className={cn('kpi-card', className)}>
        <div className="flex items-center justify-between">
          <div>
            <div className="skeleton h-4 w-3/4 mb-2" />
            <div className="skeleton h-8 w-1/2" />
          </div>
          <div className="skeleton h-10 w-10 rounded-full" />
        </div>
      </div>
    )
  }

  if (variant === 'circular') {
    return (
      <div
        className={cn('skeleton rounded-full', className)}
        style={{ width, height }}
      />
    )
  }

  if (variant === 'rectangular') {
    return (
      <div
        className={cn('skeleton rounded-input', className)}
        style={{ width, height }}
      />
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn('skeleton h-4 rounded-input', i === lines - 1 && 'w-3/4')}
          style={{ width: i === lines - 1 ? width : undefined }}
        />
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i}>
                <Skeleton variant="text" width="80%" height="16px" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, row) => (
            <tr key={row}>
              {Array.from({ length: columns }).map((_, col) => (
                <td key={col}>
                  <Skeleton variant="text" width="90%" height="14px" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}