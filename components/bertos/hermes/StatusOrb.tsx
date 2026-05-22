import { cn } from '@/lib/bertos/cn'

type StatusOrbState = 'nominal' | 'active' | 'warning' | 'danger' | 'idle' | 'loading'

const ORB_COLORS: Record<StatusOrbState, string> = {
  nominal: 'from-cyan-300 via-blue-400 to-cyan-500 shadow-cyan-400/40',
  active: 'from-emerald-300 via-cyan-400 to-blue-500 shadow-cyan-400/40',
  warning: 'from-amber-200 via-yellow-500 to-orange-500 shadow-amber-400/40',
  danger: 'from-red-300 via-rose-500 to-red-700 shadow-red-400/40',
  idle: 'from-zinc-500 via-slate-500 to-zinc-800 shadow-zinc-500/20',
  loading: 'from-cyan-200 via-violet-400 to-amber-300 shadow-cyan-400/40',
}

export function StatusOrb({
  state = 'nominal',
  size = 'md',
  className,
}: {
  state?: StatusOrbState
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const sizeClass = size === 'sm' ? 'h-2.5 w-2.5' : size === 'lg' ? 'h-12 w-12' : size === 'xl' ? 'h-16 w-16' : 'h-5 w-5'
  const pulse = state === 'active' || state === 'loading' || state === 'warning'
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center', sizeClass, className)}>
      <span className={cn('absolute inset-0 rounded-full bg-gradient-to-br blur-[2px]', ORB_COLORS[state], pulse && 'animate-pulse')} />
      <span className="absolute inset-[18%] rounded-full bg-white/45 blur-[1px]" />
      <span className="absolute inset-[32%] rounded-full bg-slate-950/80" />
    </span>
  )
}
