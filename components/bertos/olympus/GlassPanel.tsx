import type { ReactNode } from 'react'
import { cn } from '@/lib/bertos/cn'

export function GlassPanel({
  children,
  className,
  title,
  subtitle,
  action,
  ornament = true,
}: {
  children: ReactNode
  className?: string
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  ornament?: boolean
}) {
  return (
    <section className={cn('olympus-glass-panel group/panel', className)}>
      {ornament && (
        <>
          <span className="olympus-panel-corner olympus-panel-corner--tl" />
          <span className="olympus-panel-corner olympus-panel-corner--br" />
        </>
      )}
      {(title || subtitle || action) && (
        <div className="relative z-10 mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-[#F0E8D0]">{title}</h3>}
            {subtitle && <p className="mt-1 text-xs leading-relaxed text-[#9A8A68]">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="relative z-10">{children}</div>
    </section>
  )
}

export function OraclePanel(props: Parameters<typeof GlassPanel>[0]) {
  return <GlassPanel {...props} className={cn('olympus-oracle-panel', props.className)} />
}
