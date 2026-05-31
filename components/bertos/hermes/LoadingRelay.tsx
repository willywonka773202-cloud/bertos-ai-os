import { RadioTower } from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { ChamberCard } from './ChamberCard'

export function LoadingRelay({
  label = 'Hermes Relay Initializing',
  detail = 'Warming the channel and scanning live signals.',
  className,
  compact = false,
}: {
  label?: string
  detail?: string
  className?: string
  compact?: boolean
}) {
  return (
    <ChamberCard tone="cyan" className={cn('p-0', className)}>
      <div className={cn('flex items-center gap-4', compact ? 'p-4' : 'p-6')}>
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[rgba(122,188,214,0.22)] bg-[rgba(122,188,214,0.08)] text-sky-200">
          <span className="absolute inset-0 rounded-2xl border border-[rgba(122,188,214,0.28)] animate-ping" />
          <RadioTower className="relative h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-200/60">relay scan</div>
          <div className="mt-1 text-sm font-semibold text-[#F0E8D0]">{label}</div>
          <p className="mt-1 text-xs text-[#7A6A50]">{detail}</p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-[rgba(122,188,214,0.08)]">
            <div className="h-full w-1/2 animate-[shimmer_1.4s_infinite] rounded-full bg-gradient-to-r from-transparent via-[rgba(122,188,214,0.75)] to-transparent" />
          </div>
        </div>
      </div>
    </ChamberCard>
  )
}
