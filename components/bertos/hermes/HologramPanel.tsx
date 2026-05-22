import type { ReactNode } from 'react'
import { cn } from '@/lib/bertos/cn'
import { toneClasses, type HermesTone } from '@/lib/bertos/hermes-theme'

export function HologramPanel({
  children,
  className,
  tone = 'cyan',
  compact = false,
}: {
  children: ReactNode
  className?: string
  tone?: HermesTone
  compact?: boolean
}) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border backdrop-blur-xl',
        'bg-slate-950/62 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_22px_80px_rgba(0,0,0,0.28)]',
        toneClasses(tone),
        compact ? 'p-3' : 'p-4 md:p-5',
        className,
      )}
    >
      <span className="pointer-events-none absolute left-0 top-0 h-px w-24 bg-gradient-to-r from-cyan-300/70 to-transparent" />
      <span className="pointer-events-none absolute right-0 top-0 h-px w-20 bg-gradient-to-l from-amber-300/60 to-transparent" />
      <span className="pointer-events-none absolute bottom-0 left-8 h-px w-20 bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,0.10),transparent_32%),radial-gradient(circle_at_90%_10%,rgba(251,191,36,0.08),transparent_28%)]" />
      <div className="relative z-10">{children}</div>
    </section>
  )
}

export function PanelHeader({
  icon,
  eyebrow,
  title,
  subtitle,
  action,
  className,
}: {
  icon?: ReactNode
  eyebrow?: string
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-amber-200/70">{eyebrow}</div>}
          <h2 className="text-base font-semibold tracking-tight text-zinc-50">{title}</h2>
          {subtitle && <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-400">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
