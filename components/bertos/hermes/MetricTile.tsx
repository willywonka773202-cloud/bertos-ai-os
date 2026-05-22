import type { ReactNode } from 'react'
import { cn } from '@/lib/bertos/cn'
import { toneClasses, type HermesTone } from '@/lib/bertos/hermes-theme'

export function MetricTile({
  label,
  value,
  detail,
  icon,
  tone = 'cyan',
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
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.06),transparent_40%)]" />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{label}</div>
          <div className="mt-1 truncate text-xl font-semibold text-zinc-50">{value}</div>
          {detail && <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">{detail}</div>}
        </div>
        {icon && (
          <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-current/20 bg-white/5', pulse && 'animate-pulse')}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
