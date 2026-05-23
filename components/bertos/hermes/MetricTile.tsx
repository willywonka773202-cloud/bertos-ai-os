import type { ReactNode } from 'react'
import { cn } from '@/lib/bertos/cn'
import { toneClasses, type HermesTone } from '@/lib/bertos/hermes-theme'

export function MetricTile({
  label,
  value,
  detail,
  icon,
  tone = 'bronze',
  pulse = false,
  className,
}: {
  label: string
  value: ReactNode
  detail?: ReactNode
  icon?: ReactNode
  tone?: HermesTone
  pulse?: boolean
  className?: string
}) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl border p-3', toneClasses(tone), className)}>
      {/* Subtle marble sheen — top-left polish catch */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(240,232,208,0.05),transparent_38%)]" />
      {/* Engraved inner border highlight */}
      <div className="pointer-events-none absolute inset-px rounded-[10px] border border-[rgba(255,255,255,0.03)]" />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Engraved label — small caps register style */}
          <div className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[rgba(212,180,131,0.60)]">{label}</div>
          {/* Imperial numeral / value */}
          <div className="mt-1 truncate text-xl font-semibold text-[#F0E8D0]">{value}</div>
          {detail && <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#7A6848]">{detail}</div>}
        </div>
        {icon && (
          <div className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[rgba(212,180,131,0.20)] bg-[rgba(212,180,131,0.06)]',
            pulse && 'animate-pulse',
          )}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
