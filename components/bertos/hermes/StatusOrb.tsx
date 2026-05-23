import { cn } from '@/lib/bertos/cn'

type StatusOrbState = 'nominal' | 'active' | 'warning' | 'danger' | 'idle' | 'loading'

// Celestial halo orbs — warm imperial palette
const ORB_CONFIG: Record<StatusOrbState, { gradient: string; halo: string; pulse: boolean }> = {
  nominal:  { gradient: 'from-sky-200 via-sky-300 to-blue-400',         halo: 'rgba(122,188,214,0.35)', pulse: false },
  active:   { gradient: 'from-amber-100 via-amber-300 to-yellow-400',   halo: 'rgba(212,180,131,0.45)', pulse: true  },
  warning:  { gradient: 'from-amber-200 via-orange-400 to-amber-500',   halo: 'rgba(251,191,36,0.40)',  pulse: true  },
  danger:   { gradient: 'from-red-300 via-rose-500 to-red-600',         halo: 'rgba(248,113,113,0.38)', pulse: true  },
  idle:     { gradient: 'from-stone-500 via-stone-600 to-stone-800',    halo: 'rgba(120,100,70,0.20)',  pulse: false },
  loading:  { gradient: 'from-amber-100 via-sky-300 to-amber-200',      halo: 'rgba(212,180,131,0.30)', pulse: true  },
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
  const cfg = ORB_CONFIG[state]

  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center', sizeClass, className)}>
      {/* Outer halo ring — celestial glow */}
      <span
        className={cn('absolute inset-[-25%] rounded-full animate-halo')}
        style={{ boxShadow: `0 0 12px 4px ${cfg.halo}`, background: `radial-gradient(circle, ${cfg.halo} 0%, transparent 70%)` }}
      />
      {/* Core gradient sphere */}
      <span className={cn('absolute inset-0 rounded-full bg-gradient-to-br blur-[2px]', cfg.gradient, cfg.pulse && 'animate-pulse')} />
      {/* Pearl inner highlight */}
      <span className="absolute inset-[16%] rounded-full bg-white/55 blur-[1px]" />
      {/* Deep center */}
      <span className="absolute inset-[34%] rounded-full bg-[#070503]/85" />
    </span>
  )
}
