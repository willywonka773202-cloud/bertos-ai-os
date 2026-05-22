'use client'
import { motion } from 'framer-motion'
import { cn } from '@/lib/bertos/cn'

export type OrbState = 'nominal' | 'active' | 'warning' | 'danger' | 'idle' | 'loading'

const ORB_PROPS: Record<OrbState, { fill: string; glow: string; ring: string }> = {
  nominal: { fill: 'bg-emerald-400', glow: 'rgba(52,211,153,0.55)',  ring: 'ring-emerald-400/60' },
  active:  { fill: 'bg-cyan-400',    glow: 'rgba(34,211,238,0.65)',  ring: 'ring-cyan-400/60'    },
  warning: { fill: 'bg-amber-400',   glow: 'rgba(245,158,11,0.55)',  ring: 'ring-amber-400/60'   },
  danger:  { fill: 'bg-red-400',     glow: 'rgba(239,68,68,0.55)',   ring: 'ring-red-400/60'     },
  idle:    { fill: 'bg-zinc-500',    glow: 'rgba(113,113,122,0.35)', ring: 'ring-zinc-500/40'    },
  loading: { fill: 'bg-cyan-400/60', glow: 'rgba(34,211,238,0.4)',   ring: 'ring-cyan-400/30'    },
}

interface StatusOrbProps {
  state: OrbState
  size?: 'xs' | 'sm' | 'md' | 'lg'
  pulse?: boolean
  className?: string
}

export function StatusOrb({ state, size = 'sm', pulse = false, className }: StatusOrbProps) {
  const p = ORB_PROPS[state]
  const sizeMap = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  }

  const animate = pulse || state === 'active' || state === 'loading'

  return (
    <span className={cn('relative inline-flex items-center justify-center flex-shrink-0', sizeMap[size], className)}>
      <span className={cn('absolute inset-0 rounded-full', p.fill)} />
      {animate && (
        <motion.span
          className={cn('absolute inset-0 rounded-full', p.fill, 'opacity-70')}
          animate={{ scale: [1, 2.4], opacity: [0.55, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <span
        className="absolute inset-0 rounded-full"
        style={{ boxShadow: `0 0 8px ${p.glow}` }}
      />
    </span>
  )
}
