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
        'bg-[#0D0B07]/72 shadow-[inset_0_1px_0_rgba(240,232,208,0.05),0_24px_80px_rgba(0,0,0,0.32)]',
        toneClasses(tone),
        compact ? 'p-3' : 'p-4 md:p-5',
        className,
      )}
    >
      {/* Top-left gilded trim line */}
      <span className="pointer-events-none absolute left-0 top-0 h-px w-36 bg-gradient-to-r from-[rgba(212,180,131,0.65)] to-transparent" />
      {/* Top-right gilded accent */}
      <span className="pointer-events-none absolute right-0 top-0 h-px w-24 bg-gradient-to-l from-[rgba(212,180,131,0.45)] to-transparent" />
      {/* Bottom inner glow line */}
      <span className="pointer-events-none absolute bottom-0 left-6 h-px w-28 bg-gradient-to-r from-transparent via-[rgba(212,180,131,0.22)] to-transparent" />
      {/* Divine radial halo — warm gold light descending from top */}
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgba(212,180,131,0.10),transparent),radial-gradient(circle_at_90%_12%,rgba(184,137,75,0.07),transparent_30%)]" />
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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgba(212,180,131,0.25)] bg-[rgba(212,180,131,0.08)] text-amber-200 shadow-[0_0_24px_rgba(212,180,131,0.12)]">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.34em] text-[rgba(212,180,131,0.75)]">
              <span className="inline-block h-1 w-1 rotate-45 bg-[rgba(212,180,131,0.60)]" />
              {eyebrow}
              <span className="inline-block h-1 w-1 rotate-45 bg-[rgba(212,180,131,0.60)]" />
            </div>
          )}
          <h2 className="mt-0.5 text-base font-semibold tracking-tight text-[#F0E8D0]">{title}</h2>
          {subtitle && <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#8A7A5A]">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
