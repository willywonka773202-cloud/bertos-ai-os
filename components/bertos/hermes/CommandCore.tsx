import { Activity, Orbit, RadioTower } from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { ChamberCard } from './ChamberCard'
import { OperatorSigil } from './OperatorSigil'
import { XPMeter } from './XPMeter'

export function CommandCore({
  operatorName,
  rank,
  nextRank,
  xp,
  rankProgress,
  relayStreak,
  daemonOnline,
  className,
}: {
  operatorName: string
  rank: string
  nextRank: string
  xp: number
  rankProgress: number
  relayStreak: number
  daemonOnline: boolean
  className?: string
}) {
  return (
    <ChamberCard tone="bronze" className={cn('p-0', className)}>
      <div className="relative overflow-hidden rounded-xl p-5 md:p-6">
        <div className="pointer-events-none absolute inset-0 hermes-grid opacity-25" />
        <div className="pointer-events-none absolute left-1/2 top-6 h-52 w-52 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(212,180,131,0.16),rgba(122,188,214,0.08)_42%,transparent_68%)]" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(260px,0.8fr)_minmax(280px,1fr)_minmax(260px,0.8fr)] lg:items-center">
          <div className="space-y-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.30em] text-[rgba(212,180,131,0.62)]">operator praetorium</div>
            <div className="flex items-center gap-3">
              <OperatorSigil name={operatorName} rank={rank} size="lg" />
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold text-[#F0E8D0]">{operatorName}</div>
                <div className="text-sm text-[#D4B483]">{rank}</div>
              </div>
            </div>
            <XPMeter xp={xp} rank={rank} nextRank={nextRank} progress={rankProgress} />
          </div>

          <div className="flex justify-center">
            <div className="relative flex h-56 w-56 items-center justify-center rounded-full border border-[rgba(212,180,131,0.18)] bg-[rgba(10,8,5,0.40)]">
              <div className="absolute inset-4 rounded-full border border-[rgba(122,188,214,0.18)]" />
              <div className="absolute inset-10 rounded-full border border-dashed border-[rgba(212,180,131,0.22)] animate-[spin_18s_linear_infinite]" />
              <div className="absolute inset-16 rounded-full border border-[rgba(212,180,131,0.18)] bg-[radial-gradient(circle,rgba(212,180,131,0.18),rgba(122,188,214,0.08)_48%,rgba(6,4,3,0.4))]" />
              <Orbit className="absolute h-32 w-32 text-[rgba(212,180,131,0.16)]" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-[rgba(246,196,83,0.45)] bg-[#0A0806] shadow-[0_0_45px_rgba(212,180,131,0.20)]">
                <RadioTower className="h-8 w-8 text-[#D4B483]" />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <CoreStat label="Relay Streak" value={`${relayStreak} day${relayStreak === 1 ? '' : 's'}`} tone="gold" />
            <CoreStat label="Local Daemon" value={daemonOnline ? 'online' : 'offline'} tone={daemonOnline ? 'cyan' : 'amber'} />
            <CoreStat label="Command Core" value={daemonOnline ? 'live' : 'standby'} tone={daemonOnline ? 'cyan' : 'gold'} />
          </div>
        </div>
      </div>
    </ChamberCard>
  )
}

function CoreStat({ label, value, tone }: { label: string; value: string; tone: 'gold' | 'cyan' | 'amber' }) {
  return (
    <div className="rounded-xl border border-[rgba(212,180,131,0.14)] bg-[rgba(10,8,5,0.56)] p-3">
      <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#6A5A3A]">
        <Activity className={cn('h-3 w-3', tone === 'cyan' && 'text-sky-300', tone === 'amber' && 'text-amber-300', tone === 'gold' && 'text-[#D4B483]')} />
        {label}
      </div>
      <div className="text-sm font-semibold text-[#F0E8D0]">{value}</div>
    </div>
  )
}
