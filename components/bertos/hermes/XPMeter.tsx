import { cn } from '@/lib/bertos/cn'

export function XPMeter({
  xp,
  rank,
  nextRank,
  progress,
  compact = false,
  className,
}: {
  xp: number
  rank: string
  nextRank: string
  progress: number
  compact?: boolean
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-1 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.22em]">
        <span className="truncate text-[rgba(212,180,131,0.70)]">{rank}</span>
        {!compact && <span className="shrink-0 text-[#6A5A3A]">{xp} XP</span>}
      </div>
      <div className="h-2 overflow-hidden rounded-full border border-[rgba(212,180,131,0.16)] bg-[rgba(10,8,5,0.80)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#7ABCD6] via-[#D4B483] to-[#F6C453] shadow-[0_0_18px_rgba(212,180,131,0.28)] transition-all"
          style={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
        />
      </div>
      {!compact && (
        <div className="mt-1 text-[10px] text-[#5A4A2A]">
          {progress >= 100 ? 'Imperator rank stabilized' : `${progress}% to ${nextRank}`}
        </div>
      )}
    </div>
  )
}
