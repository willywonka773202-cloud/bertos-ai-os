import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { ChamberCard } from './ChamberCard'
import { XPMeter } from './XPMeter'

export function MissionCard({
  title,
  description,
  progress,
  target,
  xp,
  complete,
  className,
}: {
  title: string
  description: string
  progress: number
  target: number
  xp: number
  complete?: boolean
  className?: string
}) {
  const pct = Math.min(100, Math.round((progress / Math.max(1, target)) * 100))
  return (
    <ChamberCard
      tone={complete ? 'emerald' : 'bronze'}
      className={cn('p-0', className)}
      eyebrow={complete ? 'mission sealed' : 'active mission'}
      title={title}
      description={description}
      status={complete ? 'nominal' : 'active'}
      action={complete ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <Circle className="h-4 w-4 text-[#D4B483]" />}
    >
      <XPMeter xp={xp} rank={`${progress}/${target}`} nextRank={`${xp} XP reward`} progress={pct} compact />
    </ChamberCard>
  )
}
