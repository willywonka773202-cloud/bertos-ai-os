import type { ReactNode } from 'react'
import { Archive, Radio } from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import type { HermesTone } from '@/lib/bertos/hermes-theme'
import { ChamberCard } from './ChamberCard'
import { StatusOrb } from './StatusOrb'

export function EmptyChamber({
  icon,
  title = 'Dormant Relay',
  description = 'This chamber is waiting for a real dispatch.',
  action,
  tone = 'zinc',
  className,
}: {
  icon?: ReactNode
  title?: string
  description?: string
  action?: ReactNode
  tone?: HermesTone
  className?: string
}) {
  return (
    <ChamberCard tone={tone} className={cn('p-0', className)}>
      <div className="flex min-h-40 flex-col items-center justify-center px-6 py-10 text-center">
        <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(212,180,131,0.22)] bg-[rgba(212,180,131,0.07)] text-[#D4B483]">
          <span className="absolute -right-1 -top-1"><StatusOrb state="idle" size="sm" /></span>
          {icon ?? <Archive className="h-6 w-6" />}
        </div>
        <div className="mb-1 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.28em] text-[rgba(212,180,131,0.52)]">
          <Radio className="h-3 w-3" />
          awaiting dispatch
        </div>
        <h3 className="text-base font-semibold text-[#F0E8D0]">{title}</h3>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-[#7A6A50]">{description}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </ChamberCard>
  )
}
